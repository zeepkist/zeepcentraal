import { parse } from 'graphql'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchGraphql } from '../../server/utils/graphql'

vi.mock('nuxt/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('nuxt/server')>()),
	useRuntimeConfig: () => ({ public: { graphqlHttpUrl: 'https://example.test' } }),
}))

const document = parse('query Probe { __typename }')
const fetch = vi.fn()

beforeEach(() => {
	vi.stubGlobal('fetch', fetch)
})
afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	fetch.mockReset()
})

describe('server GraphQL fetch', () => {
	test('rejects partial data with GraphQL errors instead of caching incomplete data', async () => {
		fetch.mockResolvedValue(
			Response.json({ data: { records: null }, errors: [{ message: 'query timeout' }] }),
		)
		await expect(fetchGraphql(document, {})).rejects.toMatchObject({
			statusCode: 502,
			statusMessage: 'query timeout',
		})
	})
	test('rejects missing data and returns successful data with unchanged timeout', async () => {
		fetch.mockResolvedValueOnce(Response.json({}))
		await expect(fetchGraphql(document, {})).rejects.toMatchObject({ statusCode: 502 })
		const timeout = vi.spyOn(AbortSignal, 'timeout')
		fetch.mockResolvedValueOnce(Response.json({ data: { __typename: 'Query' }, errors: [] }))
		await expect(fetchGraphql(document, {})).resolves.toEqual({ __typename: 'Query' })
		expect(fetch).toHaveBeenLastCalledWith(
			'https://example.test/',
			expect.objectContaining({ method: 'POST' }),
		)
		expect(timeout).toHaveBeenCalledWith(10_000)
	})
})
