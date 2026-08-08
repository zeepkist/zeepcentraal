import { describe, expect, test } from 'bun:test'
import { createQueryCostEvaluator, evaluateQueryCost } from './createQueryCostMiddleware'

describe('evaluateQueryCost', () => {
	test('accepts cheap query and returns query cost', async () => {
		const result = await evaluateQueryCost({ query: '{ level { id } }' }, 5000, 100)

		expect(result.cost).toBeDefined()
		expect(result.response).toBeUndefined()
	})

	test('rejects expensive query with original error payload shape', async () => {
		const result = await evaluateQueryCost(
			{
				query: '{ levels(first: 1000) { nodes { records(first: 1000) { nodes { id } } } } }',
			},
			10,
			100,
		)

		expect(result.cost).toBeUndefined()
		expect(result.response?.status).toBe(400)
		expect(result.response?.headers.get('X-Query-Cost')).toBeDefined()
		expect(await result.response?.json()).toEqual({
			errors: [
				{
					message: 'Query Cost Exceeded',
					details: expect.stringContaining('Estimated cost:'),
				},
			],
		})
	})

	test('skips introspection query', async () => {
		const result = await evaluateQueryCost(
			{ query: '{ __schema { queryType { name } } }' },
			1,
			100,
		)

		expect(result).toEqual({})
	})

	test('returns 400 for invalid GraphQL syntax', async () => {
		const result = await evaluateQueryCost({ query: '{' }, 5000, 100)

		expect(result.response?.status).toBe(400)
		expect(await result.response?.json()).toEqual({
			errors: [
				{
					message: 'Invalid GraphQL Syntax',
					details: expect.any(String),
				},
			],
		})
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
})
