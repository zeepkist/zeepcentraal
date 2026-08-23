import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { getMeter } from '@zeepkist/telemetry'
import type { GraphQLSchema } from 'postgraphile/graphql'
import { type ElysiaGrafserv, elysiaGrafserv } from './elysiaGrafserv'
import { createGraphqlHttpHandler } from './graphqlHttp'
import { readGraphqlJsonResponse } from './graphqlResponse'
import { createLiveQueryInvalidationPoller } from './liveQueryInvalidationPoller'
import { createLiveQueryWebSocketHandlers } from './liveQueryWebSocket'
import { createQueryCostEvaluator } from './middleware/createQueryCostMiddleware'
import { serveGraphiql } from './middleware/serveGraphiql'
import type { ReadinessProbe } from './readiness'

type PostGraphileRuntimeConfig = typeof postgraphileConfig

type PostGraphileHandler = {
	createServ(adapter: typeof elysiaGrafserv): ElysiaGrafserv
	getSchema(): GraphQLSchema | PromiseLike<GraphQLSchema>
}

const readinessBody = {
	operationName: 'ZC_Readiness',
	query: 'query ZC_Readiness { versions(first: 1) { nodes { id } } }',
}

let activeLiveOperations = 0

let activeSharedLiveOperations = 0
let liveQueryQueueDepth = 0
let runningLiveQueryExecutions = 0

const meter = getMeter('zeepcentraal-postgraphile')
const activeLiveOperationsGauge = meter.createObservableGauge(
	'postgraphile.live_query.active_operations',
	{
		description: 'Active PostGraphile live query operations',
		unit: '{operation}',
	},
)
activeLiveOperationsGauge.addCallback((result) => result.observe(activeLiveOperations))

const activeSharedLiveOperationsGauge = meter.createObservableGauge(
	'postgraphile.live_query.active_shared_operations',
	{
		description: 'Active unique PostGraphile live query operations',
		unit: '{operation}',
	},
)
activeSharedLiveOperationsGauge.addCallback((result) => result.observe(activeSharedLiveOperations))

const liveQueryQueueDepthGauge = meter.createObservableGauge(
	'postgraphile.live_query.execution_queue_depth',
	{
		description: 'Queued unique PostGraphile live query executions',
		unit: '{operation}',
	},
)
liveQueryQueueDepthGauge.addCallback((result) => result.observe(liveQueryQueueDepth))

const runningLiveQueryExecutionsGauge = meter.createObservableGauge(
	'postgraphile.live_query.running_executions',
	{
		description: 'Running unique PostGraphile live query executions',
		unit: '{operation}',
	},
)
runningLiveQueryExecutionsGauge.addCallback((result) => result.observe(runningLiveQueryExecutions))

const liveQueryDeduplicationHits = meter.createCounter(
	'postgraphile.live_query.deduplication_hits',
	{
		description: 'Subscriptions joined to an existing shared live query operation',
		unit: '{subscription}',
	},
)
const liveQueryExecutions = meter.createCounter('postgraphile.live_query.executions', {
	description: 'Unique live query database executions',
	unit: '{execution}',
})
const liveQueryRejections = meter.createCounter('postgraphile.live_query.rejections', {
	description: 'Rejected live query subscription operations',
	unit: '{operation}',
})
const liveQueryExecutionDuration = meter.createHistogram(
	'postgraphile.live_query.execution_duration',
	{
		description: 'Unique live query database execution duration',
		unit: 'ms',
	},
)

function isGraphqlReadinessPayload(value: unknown): value is { data: unknown; errors?: unknown[] } {
	return typeof value === 'object' && value !== null && 'data' in value
}

export function createRuntimeReadinessProbe(server: ElysiaGrafserv): ReadinessProbe {
	return {
		start() {
			const controller = new AbortController()
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				signal: controller.signal,
			})
			const promise = (async () => {
				const response = await server.handleGraphQLRequest(request, readinessBody)
				if (!response?.ok) throw new Error('runtime readiness query failed')

				const payload = await readGraphqlJsonResponse(response)
				if (
					!isGraphqlReadinessPayload(payload) ||
					(Array.isArray(payload.errors) && payload.errors.length > 0)
				) {
					throw new Error('runtime readiness query returned GraphQL errors')
				}
			})()

			return {
				promise,
				cancel() {
					controller.abort()
				},
			}
		},
		async close() {},
	}
}

export function createPostGraphileRuntime(
	handler: PostGraphileHandler,
	config: PostGraphileRuntimeConfig = postgraphileConfig,
) {
	const server = handler.createServ(elysiaGrafserv)
	const poller = createLiveQueryInvalidationPoller({
		...config.liveQueries,
		databaseUrl: config.databaseUrl,
		databaseTimeouts: config.databaseTimeouts,
	})
	const httpQueryCostEvaluator = createQueryCostEvaluator({
		maxCost: config.maxQueryCost,
		defaultCollectionSize: config.defaultCollectionSize,
		includeTraceDetail: config.queryTraceDetail,
		cacheSize: config.cacheMaxEntries,
	})
	const liveQueryCostEvaluator = createQueryCostEvaluator({
		maxCost: config.maxQueryCost,
		defaultCollectionSize: config.defaultCollectionSize,
		includeTraceDetail: false,
		cacheSize: config.cacheMaxEntries,
	})
	const liveQueryWebSocket = createLiveQueryWebSocketHandlers({
		schema: Promise.resolve(handler.getSchema()),
		evaluateQueryCost: liveQueryCostEvaluator,
		getExecutionScopeKey: () => 'public',
		debounceMs: config.liveQueries.debounceMs,
		maxOperations: config.liveQueries.maxOperations,
		maxOperationsPerConnection: config.liveQueries.maxOperationsPerConnection,
		maxConcurrentExecutions: config.liveQueries.maxConcurrentExecutions,
		onActiveChange(active) {
			if (active) {
				poller.start(liveQueryWebSocket.invalidate)
			} else {
				poller.stop()
			}
		},
		onActiveOperationsChange(count) {
			activeLiveOperations = count
		},
		onActiveSharedOperationsChange(count) {
			activeSharedLiveOperations = count
		},
		onQueueDepthChange(count) {
			liveQueryQueueDepth = count
		},
		onRunningExecutionsChange(count) {
			runningLiveQueryExecutions = count
		},
		onDeduplication() {
			liveQueryDeduplicationHits.add(1)
		},
		onExecution(durationMs, outcome) {
			const attributes = { outcome }
			liveQueryExecutions.add(1, attributes)
			liveQueryExecutionDuration.record(durationMs, attributes)
		},
		onRejected(reason) {
			liveQueryRejections.add(1, { reason })
		},
		async execute(request, body) {
			return readGraphqlJsonResponse(await server.handleGraphQLRequest(request, body))
		},
	})

	return {
		graphqlRoute: createGraphqlHttpHandler(server, config, httpQueryCostEvaluator),
		readinessProbe: createRuntimeReadinessProbe(server),
		liveQueryWebSocket: liveQueryWebSocket.handlers,
		async serveRuruStatic(request: Request) {
			return (
				(await server.handleGraphiQLStaticRequest(request)) ??
				(await serveGraphiql(request)) ??
				new Response('Not Found', { status: 404 })
			)
		},
		async stop() {
			await poller.dispose()
		},
	}
}
