import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import {
	bindTelemetryContext,
	getActiveSpan,
	recordSpanFailure,
	setActiveSpanAttributes,
	updateActiveSpanName,
} from '@zeepkist/telemetry'
import { getOperationAST, parse } from 'postgraphile/graphql'
import type { AdmissionController } from './admissionController'
import type { ElysiaGrafserv } from './elysiaGrafserv'
import { createGraphqlResponse } from './graphqlResponse'
import type { GtrUpdateMessageProvider } from './gtrVersion'
import { collectHeaderMetrics } from './middleware/collectHeaderMetrics'
import {
	createQueryCostEvaluator,
	createQueryCostResponse,
	type QueryCostEvaluator,
} from './middleware/createQueryCostMiddleware'

type GraphqlHttpConfig = {
	maxQueryCost: number
	defaultCollectionSize: number
	cacheMaxEntries: number
	maxQueryBytes: number
}

function enrichGraphqlSpan(body: unknown) {
	const query =
		typeof body === 'string'
			? body
			: body && typeof body === 'object' && 'query' in body && typeof body.query === 'string'
				? body.query
				: undefined
	const requestedName =
		body &&
		typeof body === 'object' &&
		'operationName' in body &&
		typeof body.operationName === 'string'
			? body.operationName
			: undefined
	if (!query) return
	try {
		const operation = getOperationAST(parse(query, { noLocation: true }), requestedName)
		if (!operation) return
		const name = operation.name?.value.slice(0, 96) ?? 'anonymous'
		setActiveSpanAttributes({
			'graphql.operation.name': name,
			'graphql.operation.type': operation.operation,
		})
		updateActiveSpanName(`${operation.operation} ${name}`)
	} catch {
		// Validation layer reports malformed GraphQL without recording document content.
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

export function createGraphqlHttpHandler(
	handler: ElysiaGrafserv,
	config: GraphqlHttpConfig = postgraphileConfig,
	providedQueryCostEvaluator?: QueryCostEvaluator,
	admission?: AdmissionController,
	getGtrUpdateMessage?: GtrUpdateMessageProvider,
) {
	const evaluateQueryCost =
		providedQueryCostEvaluator ??
		createQueryCostEvaluator({
			maxCost: config.maxQueryCost,
			defaultCollectionSize: config.defaultCollectionSize,
			cacheSize: config.cacheMaxEntries,
			maxQueryBytes: config.maxQueryBytes,
		})

	return async ({ request, body }: { request: Request; body: unknown }) => {
		const admitted = admission?.admit(bindTelemetryContext(() => handleRequest(request, body)))
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
		enrichGraphqlSpan(graphqlBody)
		const queryCost =
			request.method === 'POST'
				? await evaluateQueryCost(
						typeof graphqlBody === 'string'
							? { query: graphqlBody }
							: (graphqlBody as never),
					)
				: { kind: 'empty' as const }

		setActiveSpanAttributes({
			'graphql.queryCost.cost': queryCost.cost,
			'graphql.queryCost.rejection_reason': queryCost.reason,
		})
		const span = getActiveSpan()
		if (span && queryCost.kind === 'rejected') recordSpanFailure(span, 'graphql.query_rejected')
		const queryCostResponse = createQueryCostResponse(queryCost)
		if (queryCostResponse) {
			return queryCostResponse
		}

		const gtrUpdateMessage =
			request.method === 'POST' ? await getGtrUpdateMessage?.(request.headers) : undefined
		const response = await handler.handleGraphQLRequest(request, graphqlBody, {
			gtrUpdateMessage,
		})
		if (!response) {
			return new Response('Not Found', { status: 404 })
		}

		return createGraphqlResponse(response, queryCost.cost)
	}
}
