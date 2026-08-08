import { describe, expect, test } from 'bun:test'
import { buildSchema, GraphQLSchema } from 'postgraphile/graphql'
import {
	applyGrafastCacheLimits,
	createBoundedGrafastCachesPlugin,
} from './BoundedGrafastCachesPlugin'

describe('BoundedGrafastCachesPlugin', () => {
	test('applies Grafast cache limits during schema finalization', () => {
		const schema = buildSchema('type Query { ok: Boolean }')
		const plugin = createBoundedGrafastCachesPlugin({
			maxEntries: 128,
			operationPlansPerOperation: 8,
		})
		const finalize = plugin.schema?.hooks?.finalize

		expect(finalize).toBeFunction()
		if (typeof finalize !== 'function') throw new Error('finalize hook unavailable')
		const finalizedSchema = finalize(
			schema,
			{} as never,
			{
				scope: {},
				type: 'finalize',
			} as never,
		)
		expect(finalizedSchema.extensions.grafast).toMatchObject({
			queryCacheMaxLength: 128,
			operationsCacheMaxLength: 128,
			operationOperationPlansCacheMaxLength: 8,
		})
	})

	test('preserves existing schema extensions', () => {
		const baseSchema = buildSchema('type Query { ok: Boolean }')
		const schema = new GraphQLSchema({
			...baseSchema.toConfig(),
			extensions: {
				...baseSchema.extensions,
				memoryHardeningMarker: true,
			},
		})

		const boundedSchema = applyGrafastCacheLimits(schema, {
			maxEntries: 32,
			operationPlansPerOperation: 4,
		})

		expect(boundedSchema.extensions.memoryHardeningMarker).toBe(true)
		expect(boundedSchema.extensions.grafast).toMatchObject({
			queryCacheMaxLength: 32,
			operationsCacheMaxLength: 32,
			operationOperationPlansCacheMaxLength: 4,
		})
	})
})
