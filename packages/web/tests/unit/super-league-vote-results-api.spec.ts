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
	routeHandler = (await import('../../server/api/super-league/vote-results.get'))
		.default as unknown as (event: RequestEvent) => Promise<unknown>
})
beforeEach(() => {
	roundId = '50'
	fetcher.mockReset()
	vi.stubGlobal('$fetch', fetcher)
})
afterEach(() => vi.unstubAllGlobals())

describe('anonymous vote result proxy', () => {
	it('requires positive explicit round without forwarding session cookies', async () => {
		const snapshot = {
			roundId: 50,
			categories: [
				{
					voteType: 1,
					state: 'published',
					levels: [
						{
							levelId: 1,
							authorNames: ['justMaki', 'maou'],
							authorIds: ['76561198000000001', '76561198000000003'],
						},
					],
				},
			],
		}
		fetcher.mockResolvedValue(snapshot)
		expect(await handler()).toEqual(snapshot)
		expect(event.res.headers.get('cache-control')).toBe('no-store')
		expect(fetcher).toHaveBeenCalledWith(
			'https://backend.example.test/super-league/vote-results',
			{
				query: { roundId: '50' },
				credentials: 'omit',
			},
		)
	})
	it.each([undefined, '0', '-1', '01', 'no', '2147483648', ['50', '51']])(
		'rejects invalid roundId %j',
		async (value) => {
			roundId = value
			await expect(handler()).rejects.toMatchObject({ statusCode: 400 })
			expect(fetcher).not.toHaveBeenCalled()
		},
	)
	it('preserves unknown round status and hides upstream error details', async () => {
		fetcher.mockRejectedValue({ statusCode: 404, message: 'Private upstream detail' })
		await expect(handler()).rejects.toMatchObject({
			statusCode: 404,
			message: 'Voting results could not be loaded',
		})
	})
})
