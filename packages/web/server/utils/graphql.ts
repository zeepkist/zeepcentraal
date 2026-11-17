import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { withActiveSpan } from '@zeepkist/telemetry'
import { getOperationAST, print } from 'graphql'
import { createError, useRuntimeConfig } from 'nuxt/server'
import { shouldRecordWebError } from '../../runtime/telemetryPolicy'
import { tracedWebFetch } from './tracedFetch'

export async function fetchGraphql<TData, TVariables>(
	document: TypedDocumentNode<TData, TVariables>,
	variables: TVariables,
): Promise<TData> {
	const operation = getOperationAST(document)
	return withActiveSpan(
		`${operation?.operation ?? 'query'} ${operation?.name?.value ?? 'anonymous'}`,
		{
			shouldRecordError: shouldRecordWebError,
			attributes: {
				'graphql.operation.type': operation?.operation ?? 'query',
				'graphql.operation.name': operation?.name?.value ?? 'anonymous',
			},
		},
		async () => {
			const config = useRuntimeConfig()
			const response = await tracedWebFetch<{
				data?: TData
				errors?: Array<{ message: string }>
			}>(config.public.graphqlHttpUrl, {
				method: 'POST',

				body: { query: print(document), variables },
				timeout: 10_000,
			})
			if (response.errors?.length || !response.data)
				throw createError({
					status: 502,
					statusText: response.errors?.[0]?.message ?? 'GraphQL request failed',
				})
			return response.data
		},
	)
}
