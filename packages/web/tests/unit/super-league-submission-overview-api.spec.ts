import type { RequestEvent } from 'nuxt/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequestEvent } from '../support/request-event'

vi.mock('../../server/utils/backend', () => ({
	getBackendBaseUrl: () => 'https://backend.example.test',
}))
let routeHandler: (event: RequestEvent) => Promise<unknown>
let event: RequestEvent
function handler() {
	const query = new URLSearchParams()
	if (roundId !== undefined) {
		for (const value of Array.isArray(roundId) ? roundId : [roundId])
			query.append('roundId', String(value))
	}
	event = createRequestEvent(`/?${query}`)
	return routeHandler(event)
}
let roundId: unknown
const fetcher = vi.fn()
beforeAll(async () => {
	routeHandler = (await import('../../server/api/super-league/submission-overview.get'))
		.default as unknown as (event: RequestEvent) => Promise<unknown>
})
beforeEach(() => {
	roundId = '50'
	fetcher.mockReset()
	vi.stubGlobal('$fetch', fetcher)
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
			expect(event.res.headers.get('cache-control')).toBe('no-store')
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
