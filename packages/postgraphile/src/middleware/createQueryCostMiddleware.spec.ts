import { describe, expect, test } from 'bun:test'
import { evaluateQueryCost } from './createQueryCostMiddleware'

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
})
