import { parse } from 'graphql'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchGraphql } from '../../server/utils/graphql'

vi.mock('@zeepkist/telemetry', () => ({
	injectTraceHeaders: () => ({}),
	withActiveSpan: (_name: string, _options: unknown, callback: () => unknown) => callback(),
}))

const document = parse('query Probe { __typename }')
const fetch = vi.fn()

beforeEach(() => {
	vi.stubGlobal('useRuntimeConfig', () => ({
		public: { graphqlHttpUrl: 'https://example.test' },
	}))
	vi.stubGlobal('createError', (error: object) => Object.assign(new Error(), error))
	vi.stubGlobal('$fetch', fetch)
})
afterEach(() => {
	vi.unstubAllGlobals()
	vi.resetAllMocks()
})

describe('server GraphQL fetch', () => {
	test('rejects partial data with GraphQL errors instead of caching incomplete data', async () => {
		fetch.mockResolvedValue({ data: { records: null }, errors: [{ message: 'query timeout' }] })
		await expect(fetchGraphql(document, {})).rejects.toMatchObject({
			statusCode: 502,
			statusMessage: 'query timeout',
		})
	})
	test('rejects missing data and returns successful data with unchanged timeout', async () => {
		fetch.mockResolvedValueOnce({})
		await expect(fetchGraphql(document, {})).rejects.toMatchObject({ statusCode: 502 })
		fetch.mockResolvedValueOnce({ data: { __typename: 'Query' }, errors: [] })
		await expect(fetchGraphql(document, {})).resolves.toEqual({ __typename: 'Query' })
		expect(fetch).toHaveBeenLastCalledWith(
			'https://example.test',
			expect.objectContaining({ timeout: 10_000, method: 'POST' }),
		)
	})
})
