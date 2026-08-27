import { describe, expect, test } from 'bun:test'
import { createQueryCostEvaluator, evaluateQueryCost } from './createQueryCostMiddleware'

describe('evaluateQueryCost', () => {
	test('accepts cheap query and returns query cost', async () => {
		const result = await evaluateQueryCost({ query: '{ level { id } }' }, 5000, 100)

		expect(result.kind).toBe('accepted')
		expect(result.cost).toBeDefined()
	})

	test('rejects expensive query with transport-neutral error details', async () => {
		const result = await evaluateQueryCost(
			{
				query: '{ levels(first: 1000) { nodes { records(first: 1000) { nodes { id } } } } }',
			},
			10,
			100,
		)

		expect(result).toEqual({
			kind: 'rejected',
			reason: 'cost',
			cost: expect.any(Number),
			message: 'Query Cost Exceeded',
			details: expect.stringContaining('Estimated cost:'),
		})
	})

	test('skips introspection query', async () => {
		const result = await evaluateQueryCost(
			{ query: '{ __schema { queryType { name } } }' },
			1,
			100,
		)

		expect(result).toEqual({ kind: 'introspection' })
	})

	test('returns transport-neutral rejection for invalid GraphQL syntax', async () => {
		const result = await evaluateQueryCost({ query: '{' }, 5000, 100)

		expect(result).toEqual({
			kind: 'rejected',
			reason: 'syntax',
			message: 'Invalid GraphQL Syntax',
			details: expect.any(String),
		})
	})

	test('charges non-zero cost for totalCount collections requested with first zero', async () => {
		const result = await evaluateQueryCost(
			{
				query: `
					query Metrics {
						records(first: 0) { totalCount }
						votes(first: 0) { totalCount }
					}
				`,
				operationName: 'Metrics',
			},
			5000,
			100,
		)

		expect(result.kind).toBe('accepted')
		expect(result.cost).toBeGreaterThan(2)
	})

	test('detects introspection nested through fields and fragments', async () => {
		const result = await evaluateQueryCost(
			{
				query: `
					subscription SchemaLive { query { ...SchemaFields } }
					fragment SchemaFields on Query { __schema { queryType { name } } }
				`,
				operationName: 'SchemaLive',
			},
			5000,
			100,
		)

		expect(result).toEqual({ kind: 'introspection' })
	})

	test('caches repeated query cost evaluations', async () => {
		let misses = 0
		const evaluate = createQueryCostEvaluator({
			maxCost: 5000,
			defaultCollectionSize: 100,
			onCacheMiss: () => {
				misses++
			},
		})

		await evaluate({ query: '{ level { id } }' })
		await evaluate({ query: '{ level { id } }' })

		expect(misses).toBe(1)
	})

	test('query cost cache key respects operationName', async () => {
		let misses = 0
		const evaluate = createQueryCostEvaluator({
			maxCost: 5000,
			defaultCollectionSize: 100,
			onCacheMiss: () => {
				misses++
			},
		})
		const query = `
			query FirstOperation { level { id } }
			query SecondOperation { levels(first: 1) { nodes { id } } }
		`

		await evaluate({ query, operationName: 'FirstOperation' })
		await evaluate({ query, operationName: 'SecondOperation' })
		await evaluate({ query, operationName: 'FirstOperation' })

		expect(misses).toBe(2)
	})

	test('evicts least-recent query cost entries at configured limit', async () => {
		let misses = 0
		const evaluate = createQueryCostEvaluator({
			cacheSize: 1,
			onCacheMiss: () => {
				misses++
			},
		})

		await evaluate({ query: '{ level { id } }' })
		await evaluate({ query: '{ version { id } }' })
		await evaluate({ query: '{ level { id } }' })

		expect(misses).toBe(3)
	})

	test('rejects oversized UTF-8 query before parsing or caching', async () => {
		let misses = 0
		const evaluate = createQueryCostEvaluator({
			maxQueryBytes: 8,
			onCacheMiss: () => {
				misses++
			},
		})

		expect(await evaluate({ query: '# éééé' })).toEqual({
			kind: 'rejected',
			reason: 'size',
			message: 'GraphQL query is too large',
			details: 'Query exceeds 8 byte limit',
		})
		expect(misses).toBe(0)
	})
})
