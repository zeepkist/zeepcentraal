import type { RequestEvent } from 'nuxt/server'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequestEvent } from '../support/request-event'

vi.mock('../../server/utils/backend', () => ({
	getBackendBaseUrl: () => 'https://backend.example.test',
}))

let handler: (event: RequestEvent) => Promise<unknown>
beforeAll(async () => {
	handler = (await import('../../server/api/super-league/contests.get'))
		.default as unknown as typeof handler
})
afterEach(() => vi.unstubAllGlobals())

describe('public Super League contests proxy', () => {
	it('returns current contest actions without forwarding visitor credentials or caching deadlines', async () => {
		const contests = [{ roundId: 50, openTypes: [2, 3], resultTypes: [1] }]
		const fetcher = vi.fn().mockResolvedValue(contests)
		vi.stubGlobal('$fetch', fetcher)
		const event = createRequestEvent('/api/super-league/contests', {
			headers: { cookie: 'session=fake-cookie' },
		})
		expect(await handler(event)).toEqual(contests)
		expect(event.res.headers.get('cache-control')).toBe('no-store')
		expect(fetcher).toHaveBeenCalledWith('https://backend.example.test/super-league/contests', {
			credentials: 'omit',
			cache: 'no-store',
		})
	})
	it('reports upstream failure without exposing backend details', async () => {
		vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('Private backend detail')))
		const event = createRequestEvent('/api/super-league/contests')
		await expect(handler(event)).rejects.toMatchObject({
			statusCode: 502,
			message: 'Super League contests could not be loaded',
		})
		expect(event.res.headers.get('cache-control')).toBe('no-store')
	})
})
