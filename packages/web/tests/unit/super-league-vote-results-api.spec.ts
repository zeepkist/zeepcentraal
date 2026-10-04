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
	handler = (await import('../../server/api/super-league/vote-results.get'))
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

describe('anonymous vote result proxy', () => {
	it('requires positive explicit round without forwarding session cookies', async () => {
		const snapshot = { roundId: 50, categories: [] }
		fetcher.mockResolvedValue(snapshot)
		expect(await handler()).toEqual(snapshot)
		expect(header).toHaveBeenCalledWith(undefined, 'cache-control', 'no-store')
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
