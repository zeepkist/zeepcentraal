import { describe, expect, test, vi } from 'vitest'
import { resolveVerifiedSession } from '../../server/utils/session'

function sessionCookies(accessExpiry: number, accessToken = 'access') {
	const payload = Buffer.from(JSON.stringify({ exp: accessExpiry })).toString('base64url')
	return `zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=${accessToken}.${payload}.signature; zeepcentral_refresh_token=refresh`
}

const validCookies = sessionCookies(2_000_000_000)
const expiredCookies = sessionCookies(1)
const refreshedCookies =
	'zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=next-access; zeepcentral_refresh_token=next-refresh'

describe('SSR session resolution', () => {
	test('does not query or refresh without the complete cookie tuple', async () => {
		const lookup = vi.fn()
		const canRefresh = vi.fn()
		const refresh = vi.fn()
		expect(
			await resolveVerifiedSession('zeepcentral_steam_id=1', lookup, canRefresh, refresh),
		).toEqual({ session: null, reason: 'incomplete_cookies' })
		expect(lookup).not.toHaveBeenCalled()
		expect(canRefresh).not.toHaveBeenCalled()
		expect(refresh).not.toHaveBeenCalled()
	})

	test('trusts an exact current tuple without refreshing', async () => {
		const session = { id: 1 }
		const lookup = vi.fn().mockResolvedValue(session)
		const canRefresh = vi.fn()
		const refresh = vi.fn()
		expect(await resolveVerifiedSession(validCookies, lookup, canRefresh, refresh)).toEqual({
			session,
			reason: 'verified',
		})
		expect(lookup).toHaveBeenCalledOnce()
		expect(canRefresh).not.toHaveBeenCalled()
		expect(refresh).not.toHaveBeenCalled()
	})

	for (const [label, cookies] of [
		['fresh mismatched', validCookies],
		['expired', expiredCookies],
	] as const) {
		test(`repairs and revalidates a ${label} access token with an authoritative refresh token`, async () => {
			const session = { id: 1 }
			const lookup = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(session)
			const canRefresh = vi.fn().mockResolvedValue(true)
			const refresh = vi.fn().mockResolvedValue(refreshedCookies)

			expect(await resolveVerifiedSession(cookies, lookup, canRefresh, refresh)).toEqual({
				session,
				reason: 'refreshed',
			})
			expect(canRefresh).toHaveBeenCalledWith({
				steamId: '76561198000000000',
				refreshToken: 'refresh',
			})
			expect(lookup).toHaveBeenNthCalledWith(2, {
				steamId: '76561198000000000',
				accessToken: 'next-access',
				refreshToken: 'next-refresh',
			})
		})
	}

	test('does not rotate an unmatched refresh token', async () => {
		const refresh = vi.fn()
		expect(
			await resolveVerifiedSession(
				validCookies,
				vi.fn().mockResolvedValue(null),
				vi.fn().mockResolvedValue(false),
				refresh,
			),
		).toEqual({ session: null, reason: 'invalid_tuple' })
		expect(refresh).not.toHaveBeenCalled()
	})

	test('reports failed rotation and failed post-refresh validation', async () => {
		const lookup = vi.fn().mockResolvedValue(null)
		const canRefresh = vi.fn().mockResolvedValue(true)
		expect(
			await resolveVerifiedSession(
				validCookies,
				lookup,
				canRefresh,
				vi.fn().mockRejectedValue(new Error('invalid refresh')),
			),
		).toEqual({ session: null, reason: 'refresh_failed' })

		expect(
			await resolveVerifiedSession(
				validCookies,
				lookup,
				canRefresh,
				vi.fn().mockResolvedValue(refreshedCookies),
			),
		).toEqual({ session: null, reason: 'refreshed_tuple_invalid' })
	})

	test('reports database failure without attempting backend refresh', async () => {
		const refresh = vi.fn()
		expect(
			await resolveVerifiedSession(
				validCookies,
				vi.fn().mockRejectedValue(new Error('database unavailable')),
				vi.fn(),
				refresh,
			),
		).toEqual({ session: null, reason: 'database_error' })
		expect(refresh).not.toHaveBeenCalled()
	})
})
