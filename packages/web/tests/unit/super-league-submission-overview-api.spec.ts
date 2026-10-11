import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/backend', () => ({
	getBackendBaseUrl: () => 'https://backend.example.test',
}))
let handler: () => Promise<unknown>
let roundId: unknown
const fetcher = vi.fn()
const header = vi.fn()
beforeAll(async () => {
	vi.stubGlobal('defineEventHandler', (callback: unknown) => callback)
	handler = (await import('../../server/api/super-league/submission-overview.get'))
		.default as unknown as () => Promise<unknown>
})
beforeEach(() => {
	roundId = '50'
	fetcher.mockReset()
	header.mockClear()
	vi.stubGlobal('getQuery', () => ({ roundId }))
	vi.stubGlobal('setResponseHeader', header)
	vi.stubGlobal('$fetch', fetcher)
	vi.stubGlobal('createError', (options: { statusCode: number; statusMessage: string }) =>
		Object.assign(new Error(options.statusMessage), options),
	)
})
afterEach(() => vi.unstubAllGlobals())
describe('public submission overview proxy', () => {
	it.each(['50', undefined])(
		'allows explicit or current contest without forwarding cookies: %j',
		async (value) => {
			roundId = value
			fetcher.mockResolvedValue({
				contest: null,
				submissions: [],
				validCount: 0,
				totalCount: 0,
			})
			await handler()
			expect(fetcher).toHaveBeenCalledWith(
				'https://backend.example.test/super-league/submission-overview',
				{
					query: value === undefined ? undefined : { roundId: value },
					credentials: 'omit',
				},
			)
			expect(header).toHaveBeenCalledWith(undefined, 'cache-control', 'no-store')
		},
	)
	it.each(['0', '-1', '01', 'no', '2147483648', ['50', '51']])(
		'rejects invalid roundId %j',
		async (value) => {
			roundId = value
			await expect(handler()).rejects.toMatchObject({ statusCode: 400 })
			expect(fetcher).not.toHaveBeenCalled()
		},
	)
	it('hides upstream error details', async () => {
		fetcher.mockRejectedValue(new Error('Private detail'))
		await expect(handler()).rejects.toMatchObject({
			statusCode: 502,
			message: 'Submission overview could not be loaded',
		})
	})
})
