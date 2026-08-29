import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { injectTraceHeaders, withActiveSpan } from '@zeepkist/telemetry'
import { getOperationAST, print } from 'graphql'

export async function fetchGraphql<TData, TVariables>(
	document: TypedDocumentNode<TData, TVariables>,
	variables: TVariables,
): Promise<TData> {
	const operation = getOperationAST(document)
	return withActiveSpan(
		`${operation?.operation ?? 'query'} ${operation?.name?.value ?? 'anonymous'}`,
		{
			attributes: {
				'graphql.operation.type': operation?.operation ?? 'query',
				'graphql.operation.name': operation?.name?.value ?? 'anonymous',
			},
		},
		async () => {
			const config = useRuntimeConfig()
			const response = await $fetch<{ data?: TData; errors?: Array<{ message: string }> }>(
				config.public.graphqlHttpUrl,
				{
					method: 'POST',
					headers: injectTraceHeaders(),
					body: { query: print(document), variables },
					timeout: 10_000,
				},
			)
			if (!response.data)
				throw createError({
					statusCode: 502,
					statusMessage: response.errors?.[0]?.message ?? 'GraphQL request failed',
				})
			return response.data
		},
	)
}
