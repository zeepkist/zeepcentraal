import { describe, expect, test } from 'bun:test'
import { createQueryCostMiddleware } from './createQueryCostMiddleware'

type TestContext = {
	method: string
	path: string
	status?: number
	body?: unknown
	request: {
		body?: unknown
	}
	headers: Record<string, string | undefined>
	responseHeaders: Record<string, string>
	set(name: string, value: string): void
}

function createContext(query: string): TestContext {
	return {
		method: 'POST',
		path: '/',
		request: {
			body: { query },
		},
		headers: {},
		responseHeaders: {},
		set(name, value) {
			this.responseHeaders[name] = value
		},
	}
}

describe('createQueryCostMiddleware', () => {
	test('accepts cheap query and sets query cost header', async () => {
		const ctx = createContext('{ level { id } }')
		let calledNext = false

		await createQueryCostMiddleware(5000, 100)(ctx as never, async () => {
			calledNext = true
		})

		expect(calledNext).toBe(true)
		expect(ctx.responseHeaders['X-Query-Cost']).toBeDefined()
		expect(ctx.status).toBeUndefined()
	})

	test('rejects expensive query with original error payload shape', async () => {
		const ctx = createContext(
			'{ levels(first: 1000) { nodes { records(first: 1000) { nodes { id } } } } }',
		)
		let calledNext = false

		await createQueryCostMiddleware(10, 100)(ctx as never, async () => {
			calledNext = true
		})

		expect(calledNext).toBe(false)
		expect(ctx.status).toBe(400)
		expect(ctx.body).toEqual({
			errors: [
				{
					message: 'Query Cost Exceeded',
					details: expect.stringContaining('Estimated cost:'),
				},
			],
		})
	})

	test('skips introspection query', async () => {
		const ctx = createContext('{ __schema { queryType { name } } }')
		let calledNext = false

		await createQueryCostMiddleware(1, 100)(ctx as never, async () => {
			calledNext = true
		})

		expect(calledNext).toBe(true)
		expect(ctx.responseHeaders['X-Query-Cost']).toBeUndefined()
		expect(ctx.status).toBeUndefined()
	})

	test('returns 400 for invalid GraphQL syntax', async () => {
		const ctx = createContext('{')
		let calledNext = false

		await createQueryCostMiddleware(5000, 100)(ctx as never, async () => {
			calledNext = true
		})

		expect(calledNext).toBe(false)
		expect(ctx.status).toBe(400)
		expect(ctx.body).toEqual({
			errors: [
				{
					message: 'Invalid GraphQL Syntax',
					details: expect.any(String),
				},
			],
		})
	})
})
