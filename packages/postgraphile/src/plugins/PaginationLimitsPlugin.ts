import type { GraphileField, GraphilePlugin } from '../types'

const DEFAULT_LIMIT = 100
const MAXIMUM_LIMIT = 1000

type PaginationArgs = {
	first?: number
	last?: number
}

export const PaginationLimitsPlugin: GraphilePlugin = (builder) => {
	builder.hook<GraphileField>('GraphQLObjectType:fields:field', (field, _build, context) => {
		const fieldName = context.scope.fieldName ?? field.name
		const originalResolve =
			field.resolve ?? ((parent: Record<string, unknown>) => parent[fieldName ?? ''])

		return {
			...field,
			async resolve(parent, args, resolverContext, info) {
				const paginationArgs = args as PaginationArgs

				if (paginationArgs.first !== undefined && paginationArgs.first > MAXIMUM_LIMIT) {
					throw new Error(
						`Requested 'first' value of ${paginationArgs.first} exceeds the limit of ${MAXIMUM_LIMIT}`,
					)
				}
				if (paginationArgs.last !== undefined && paginationArgs.last > MAXIMUM_LIMIT) {
					throw new Error(
						`Requested 'last' value of ${paginationArgs.last} exceeds the limit of ${MAXIMUM_LIMIT}`,
					)
				}

				if (paginationArgs.first === undefined && paginationArgs.last === undefined) {
					paginationArgs.first = DEFAULT_LIMIT
				}

				return originalResolve(parent, args, resolverContext, info)
			},
		}
	})
}
