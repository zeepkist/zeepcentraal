import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type { ElysiaGrafserv } from './elysiaGrafserv'
import { createGraphqlResponse } from './graphqlResponse'
import { collectHeaderMetrics } from './middleware/collectHeaderMetrics'
import {
	createQueryCostEvaluator,
	createQueryCostResponse,
	type QueryCostEvaluator,
} from './middleware/createQueryCostMiddleware'

type GraphqlHttpConfig = {
	maxQueryCost: number
	defaultCollectionSize: number
	queryTraceDetail: boolean
	cacheMaxEntries: number
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

export function createGraphqlHttpHandler(
	handler: ElysiaGrafserv,
	config: GraphqlHttpConfig = postgraphileConfig,
	providedQueryCostEvaluator?: QueryCostEvaluator,
) {
	const evaluateQueryCost =
		providedQueryCostEvaluator ??
		createQueryCostEvaluator({
			maxCost: config.maxQueryCost,
			defaultCollectionSize: config.defaultCollectionSize,
			includeTraceDetail: config.queryTraceDetail,
			cacheSize: config.cacheMaxEntries,
		})

	return async ({ request, body }: { request: Request; body: unknown }) => {
		collectHeaderMetrics(request.headers)

		const graphqlBody = await parseGraphqlBody(request, body)
		const queryCost =
			request.method === 'POST'
				? await evaluateQueryCost(graphqlBody as never)
				: { kind: 'empty' as const }

		const queryCostResponse = createQueryCostResponse(queryCost)
		if (queryCostResponse) {
			return queryCostResponse
		}

		const response = await handler.handleGraphQLRequest(request, graphqlBody)
		if (!response) {
			return new Response('Not Found', { status: 404 })
		}

		return createGraphqlResponse(response, queryCost.cost)
	}
}
