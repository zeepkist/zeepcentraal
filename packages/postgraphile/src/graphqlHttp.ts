import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type { AdmissionController } from './admissionController'
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
	maxQueryBytes: number
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
	admission?: AdmissionController,
) {
	const evaluateQueryCost =
		providedQueryCostEvaluator ??
		createQueryCostEvaluator({
			maxCost: config.maxQueryCost,
			defaultCollectionSize: config.defaultCollectionSize,
			includeTraceDetail: config.queryTraceDetail,
			cacheSize: config.cacheMaxEntries,
			maxQueryBytes: config.maxQueryBytes,
		})

	return async ({ request, body }: { request: Request; body: unknown }) => {
		const admitted = admission?.admit(() => handleRequest(request, body))
		if (admission) {
			if (admitted) return admitted
			return Response.json(
				{ errors: [{ message: 'GraphQL service is overloaded; retry later' }] },
				{ status: 429, headers: { 'Retry-After': '1' } },
			)
		}

		return handleRequest(request, body)
	}

	async function handleRequest(request: Request, body: unknown) {
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
