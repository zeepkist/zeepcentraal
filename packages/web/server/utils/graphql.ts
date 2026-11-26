import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { getOperationAST, print } from 'graphql'
import { createError, useRuntimeConfig } from 'nuxt/server'
import { tracedWebFetch } from './tracedFetch'

export async function fetchGraphql<TData, TVariables>(
	document: TypedDocumentNode<TData, TVariables>,
	variables: TVariables,
): Promise<TData> {
	const operation = getOperationAST(document)
	const type = operation?.operation ?? 'query'
	const name = operation?.name?.value ?? 'anonymous'
	const config = useRuntimeConfig()
	const response = await tracedWebFetch<{
		data?: TData
		errors?: Array<{ message: string }>
	}>(
		config.public.graphqlHttpUrl,
		{
			method: 'POST',
			body: { query: print(document), variables },
			timeout: 10_000,
			telemetry: {
				name: `${type} ${name}`,
				attributes: { 'graphql.operation.type': type, 'graphql.operation.name': name },
			},
		},
		(response) => {
			if (response.errors?.length || !response.data)
				throw createError({
					status: 502,
					statusText: response.errors?.[0]?.message ?? 'GraphQL request failed',
				})
		},
	)
	return response.data as TData
}
