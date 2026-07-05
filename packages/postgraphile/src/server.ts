import cors from '@elysiajs/cors'
import PgAggregatesPlugin from '@graphile/pg-aggregates'
import SubscriptionsLdsPlugin from '@graphile/subscriptions-lds'
import PgManyToManyPlugin from '@graphile-contrib/pg-many-to-many'
import PgOrderByRelatedPlugin from '@graphile-contrib/pg-order-by-related'
import PgSimplifyInflectorPlugin from '@graphile-contrib/pg-simplify-inflector'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import logixlysia from 'logixlysia'
import { type HttpRequestHandler, type PostGraphileOptions, postgraphile } from 'postgraphile'
import ConnectionFilterPlugin from 'postgraphile-plugin-connection-filter'
import { collectHeaderMetrics } from './middleware/collectHeaderMetrics'
import { evaluateQueryCost } from './middleware/createQueryCostMiddleware'
import { serveGraphiql } from './middleware/serveGraphiql'
import { AddCdnToUrlsPlugin } from './plugins/AddCdnToUrlsPlugin'
import PgFixForeignKeyNamesPlugin from './plugins/FixForeignKeyNamesPlugin'
import { HideAuthOrderByEnumsPlugin } from './plugins/HideAuthOrderByEnumsPlugin'
import PgManyToManyInflectorsPlugin from './plugins/ManyToManyInflectorsPlugin'
import OrderByRelatedInflectorsPlugin from './plugins/OrderByRelatedInflectorsPlugin'
import { PaginationLimitsPlugin } from './plugins/PaginationLimitsPlugin'
import { SkipByNodeIdFieldsPlugin } from './plugins/SkipByNodeIdFieldsPlugin'
import { TracePlugin } from './plugins/TracePlugin'
import {
	handlePostGraphileRequest,
	handlePostGraphileRouteRequest,
} from './postgraphileFetchAdapter'
import { createPostGraphileWebSocketHandlers } from './postgraphileWebSocket'

const plugins = [
	ConnectionFilterPlugin,
	PgFixForeignKeyNamesPlugin,
	PgSimplifyInflectorPlugin,
	PgManyToManyPlugin,
	PgManyToManyInflectorsPlugin,
	PgOrderByRelatedPlugin,
	OrderByRelatedInflectorsPlugin,
	SubscriptionsLdsPlugin,
	PgAggregatesPlugin,
	TracePlugin,
	PaginationLimitsPlugin,
	AddCdnToUrlsPlugin,
	SkipByNodeIdFieldsPlugin,
	HideAuthOrderByEnumsPlugin,
]

export function createPostGraphileHandler() {
	return postgraphile(postgraphileConfig.databaseUrl, 'public', createPostGraphileOptions())
}

export function createPostGraphileOptions(): PostGraphileOptions {
	return {
		appendPlugins: plugins,
		live: true,
		websockets: [],
		ownerConnectionString: postgraphileConfig.databaseUrl,
		retryOnInitFail: true,
		watchPg: true,
		graphiql: false,
		enhanceGraphiql: false,
		graphqlRoute: '/',
		disableDefaultMutations: true,
		dynamicJson: false,
		extendedErrors: ['hint', 'detail', 'errcode'],
		sortExport: true,
		enableQueryBatching: true,
		ignoreRBAC: true,
		setofFunctionsContainNulls: false,
		legacyRelations: 'omit',
		simpleCollections: 'omit',
		enableCors: true,
		ignoreIndexes: true,
		allowExplain: postgraphileConfig.allowExplain,
		graphileBuildOptions: {
			connectionFilterRelations: true,
			connectionFilterUseListInflectors: false,
			orderByRelatedColumnAggregates: true,
			pgSimplifyAllRows: true,
			pgSimplifyPatch: true,
			pgOmitListSuffix: false,
			pgShortPk: true,
		},
	}
}

async function parseGraphqlBody(request: Request, body: unknown) {
	if (request.method !== 'POST') {
		return undefined
	}

	if (typeof body === 'string' || (body && typeof body === 'object')) {
		return body
	}

	const contentType = request.headers.get('content-type') ?? ''

	try {
		if (contentType.includes('application/graphql')) {
			return await request.clone().text()
		}

		if (contentType.includes('application/json')) {
			return await request.clone().json()
		}
	} catch {
		return body
	}

	return body
}

function redirectToRoot(request: Request) {
	return Response.redirect(new URL('/', request.url).toString(), 302)
}

function createGraphqlRoute(handler: HttpRequestHandler) {
	return async ({ request, body }: { request: Request; body: unknown }) => {
		collectHeaderMetrics(request.headers)

		const graphqlBody = await parseGraphqlBody(request, body)
		const queryCost =
			request.method === 'POST'
				? await evaluateQueryCost(
						graphqlBody as never,
						postgraphileConfig.maxQueryCost,
						postgraphileConfig.defaultCollectionSize,
						postgraphileConfig.queryTraceDetail,
					)
				: {}

		if (queryCost.response) {
			return queryCost.response
		}

		return handlePostGraphileRequest(
			handler,
			request,
			graphqlBody,
			queryCost.cost ? { 'X-Query-Cost': String(queryCost.cost) } : undefined,
		)
	}
}

function createEventStreamRoute(handler: HttpRequestHandler) {
	return async ({ request }: { request: Request }) => {
		if (!handler.eventStreamRouteHandler) {
			return new Response('Not Found', { status: 404 })
		}

		return handlePostGraphileRouteRequest(handler.eventStreamRouteHandler, request, undefined)
	}
}

const withTelemetry = createElysiaTelemetryPlugin({
	packageName: 'postgraphile',
	collectorUrl: postgraphileConfig.otel.collectorUrl,
	nodeEnv: postgraphileConfig.nodeEnv,
	serviceName: postgraphileConfig.otel.serviceName,
	serviceVersion: postgraphileConfig.otel.serviceVersion,
})

const withLogging = postgraphileConfig.requestLogging
	? logixlysia({
			config: {
				showStartupMessage: false,
				disableFileLogging: true,
				requestId: false,
				customLogFormat:
					'{now} {level}\t{method}\t{status} {pathname} {duration} {speed} {ip}',
			},
		})
	: new Elysia()

export function buildPostGraphileServer(handler = createPostGraphileHandler()) {
	const graphqlRoute = createGraphqlRoute(handler)
	const eventStreamRoute = createEventStreamRoute(handler)
	const websocketHandlers = createPostGraphileWebSocketHandlers(handler)

	return new Elysia({
		aot: true,
		precompile: true,
		serve: {
			development: postgraphileConfig.nodeEnv !== 'production',
		},
	})
		.use(withLogging)
		.use(cors())
		.use(withTelemetry)
		.get('/healthz', () => 'OK')
		.head('/healthz', () => 'OK')
		.get('/', ({ request }) => serveGraphiql(request))
		.get('/graphiql', ({ request }) => redirectToRoot(request))
		.get('/graphql', ({ request }) => redirectToRoot(request))
		.all('/ruru-static/*', async ({ request }) => {
			return (await serveGraphiql(request)) ?? new Response('Not Found', { status: 404 })
		})
		.ws('/', websocketHandlers)
		.get('/stream', eventStreamRoute)
		.post('/', graphqlRoute)
		.options('/', graphqlRoute)
}
