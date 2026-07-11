import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print } from 'graphql'

export async function fetchGraphql<TData, TVariables>(
	document: TypedDocumentNode<TData, TVariables>,
	variables: TVariables,
): Promise<TData> {
	const config = useRuntimeConfig()
	const response = await $fetch<{ data?: TData; errors?: Array<{ message: string }> }>(
		config.public.graphqlHttpUrl,
		{
			method: 'POST',
			body: { query: print(document), variables },
			timeout: 10_000,
		},
	)
	if (!response.data)
		throw createError({
			statusCode: 502,
			statusMessage: response.errors?.[0]?.message ?? 'GraphQL sitemap request failed',
		})
	return response.data
}
