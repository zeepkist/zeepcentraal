import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type { ElysiaGrafserv } from './elysiaGrafserv'
import { collectHeaderMetrics } from './middleware/collectHeaderMetrics'
import { createQueryCostEvaluator } from './middleware/createQueryCostMiddleware'

type GraphqlHttpConfig = {
	maxQueryCost: number
	defaultCollectionSize: number
	queryTraceDetail: boolean
}

const DEFAULT_QUERY_COST_CACHE_SIZE = 500
const EVENT_STREAM_HEADER = 'X-GraphQL-Event-Stream'

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
	handler: ElysiaGrafserv,
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

		const response = await handler.handleGraphQLRequest(request, graphqlBody)
		if (!response) {
			return new Response('Not Found', { status: 404 })
		}

		const headers = new Headers(response.headers)
		headers.delete(EVENT_STREAM_HEADER)

		if (queryCost.cost) {
			headers.set('X-Query-Cost', String(queryCost.cost))
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		})
	}
}

export function createEventStreamHandler(handler: ElysiaGrafserv) {
	return async ({ request }: { request: Request }) => {
		return (
			(await handler.handleEventStreamRequest(request)) ??
			new Response('Not Found', { status: 404 })
		)
	}
}
