import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type { HttpRequestHandler } from 'postgraphile'
import { collectHeaderMetrics } from './middleware/collectHeaderMetrics'
import { createQueryCostEvaluator } from './middleware/createQueryCostMiddleware'
import {
	handlePostGraphileRequest,
	handlePostGraphileRouteRequest,
} from './postgraphileFetchAdapter'

type GraphqlHttpConfig = {
	maxQueryCost: number
	defaultCollectionSize: number
	queryTraceDetail: boolean
}

const DEFAULT_QUERY_COST_CACHE_SIZE = 500

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

export function createGraphqlHttpHandler(
	handler: HttpRequestHandler,
	config: GraphqlHttpConfig = postgraphileConfig,
) {
	const evaluateQueryCost = createQueryCostEvaluator({
		maxCost: config.maxQueryCost,
		defaultCollectionSize: config.defaultCollectionSize,
		includeTraceDetail: config.queryTraceDetail,
		cacheSize: DEFAULT_QUERY_COST_CACHE_SIZE,
	})

	return async ({ request, body }: { request: Request; body: unknown }) => {
		collectHeaderMetrics(request.headers)

		const graphqlBody = await parseGraphqlBody(request, body)
		const queryCost =
			request.method === 'POST' ? await evaluateQueryCost(graphqlBody as never) : {}

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

export function createEventStreamHandler(handler: HttpRequestHandler) {
	return async ({ request }: { request: Request }) => {
		if (!handler.eventStreamRouteHandler) {
			return new Response('Not Found', { status: 404 })
		}

		return handlePostGraphileRouteRequest(handler.eventStreamRouteHandler, request, undefined)
	}
}
