import { GraphQLSchema } from 'postgraphile/graphql'

type GrafastCacheLimits = {
	maxEntries: number
	operationPlansPerOperation: number
}

export function applyGrafastCacheLimits(schema: GraphQLSchema, limits: GrafastCacheLimits) {
	return new GraphQLSchema({
		...schema.toConfig(),
		extensions: {
			...schema.extensions,
			grafast: {
				...schema.extensions.grafast,
				queryCacheMaxLength: limits.maxEntries,
				operationsCacheMaxLength: limits.maxEntries,
				operationOperationPlansCacheMaxLength: limits.operationPlansPerOperation,
			},
		},
	})
}

export function createBoundedGrafastCachesPlugin(
	limits: GrafastCacheLimits,
): GraphileConfig.Plugin {
	return {
		name: 'BoundedGrafastCachesPlugin',
		version: '1.0.0',
		schema: {
			hooks: {
				finalize(schema) {
					return applyGrafastCacheLimits(schema, limits)
				},
			},
		},
	}
}
