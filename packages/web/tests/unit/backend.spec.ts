import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	accessTokenExpiresAt,
	accessTokenRefreshAt,
	cookieHeaderFromSetCookies,
	fetchAuthenticatedBackend,
	readRefreshableSessionCookies,
	readSessionCookies,
} from '../../server/utils/backend'
import { isCrossOriginRequest } from '../../server/utils/request'

afterEach(() => {
	vi.unstubAllGlobals()
})

function response(status: number, data?: unknown, setCookies: string[] = []) {
	return {
		status,
		_data: data,
		headers: {
			get: () => null,
			getSetCookie: () => setCookies,
		},
	}
}

describe('web server auth and request guards', () => {
	test('schedules access refresh one minute before JWT expiry', () => {
		const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000 })).toString('base64url')
		expect(accessTokenExpiresAt(`zeepcentral_access_token=x.${payload}.x`)).toBe(
			2_000_000_000_000,
		)
		expect(accessTokenRefreshAt(`zeepcentral_access_token=x.${payload}.x`)).toBe(
			1_999_999_940_000,
		)
	})

	test('reads refreshable and complete server-issued web auth cookie tuples', () => {
		expect(
			readSessionCookies(
				'zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=access; zeepcentral_refresh_token=refresh',
			),
		).toEqual({
			steamId: '76561198000000000',
			accessToken: 'access',
			refreshToken: 'refresh',
		})
		expect(
			readRefreshableSessionCookies(
				'zeepcentral_steam_id=76561198000000000; zeepcentral_refresh_token=refresh',
			),
		).toEqual({
			steamId: '76561198000000000',
			refreshToken: 'refresh',
		})
		expect(
			readSessionCookies(
				'zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=access',
			),
		).toBeNull()
		expect(readRefreshableSessionCookies('zeepcentral_steam_id=76561198000000000')).toBeNull()
		expect(readSessionCookies('zeepcentral_refresh_token=%E0%A4%A')).toBeNull()
		expect(readRefreshableSessionCookies('zeepcentral_refresh_token=%E0%A4%A')).toBeNull()
	})

	test('turns refreshed Set-Cookie headers into a validation cookie header', () => {
		expect(
			cookieHeaderFromSetCookies([
				'zeepcentral_access_token=next-access; Path=/; HttpOnly',
				'zeepcentral_refresh_token=next-refresh; Path=/; HttpOnly',
				'zeepcentral_steam_id=76561198000000000; Path=/',
			]),
		).toBe(
			'zeepcentral_access_token=next-access; zeepcentral_refresh_token=next-refresh; zeepcentral_steam_id=76561198000000000',
		)
	})

	test('rejects cross-site and mismatched-origin API requests', () => {
		expect(isCrossOriginRequest(undefined, 'cross-site', 'https://zeepki.st')).toBe(true)
		expect(
			isCrossOriginRequest('https://example.com', 'same-origin', 'https://zeepki.st'),
		).toBe(true)
		expect(isCrossOriginRequest('https://zeepki.st', 'same-origin', 'https://zeepki.st')).toBe(
			false,
		)
		expect(isCrossOriginRequest(undefined, undefined, 'https://zeepki.st')).toBe(false)
	})

	test('retains JSON mutation body through authenticated refresh retry', async () => {
		const raw = vi
			.fn()
			.mockResolvedValueOnce(response(401))
			.mockResolvedValueOnce(
				response(204, undefined, [
					'zeepcentral_access_token=next-access; Path=/; HttpOnly',
					'zeepcentral_refresh_token=next-refresh; Path=/; HttpOnly',
					'zeepcentral_steam_id=76561198000000000; Path=/',
				]),
			)
			.mockResolvedValueOnce(response(204))
		vi.stubGlobal('$fetch', { raw })
		vi.stubGlobal('useRuntimeConfig', () => ({
			public: { backendUrl: 'https://backend.example/' },
		}))
		vi.stubGlobal('getHeader', (_event: unknown, name: string) =>
			name === 'cookie'
				? 'zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=old; zeepcentral_refresh_token=refresh'
				: undefined,
		)
		vi.stubGlobal('appendResponseHeader', vi.fn())
		vi.stubGlobal('createError', (input: object) => Object.assign(new Error(), input))
		const body = { hash: '0123456789ABCDEF0123456789ABCDEF' }

		await fetchAuthenticatedBackend({}, '/favourite/add', { method: 'POST', body })

		expect(raw).toHaveBeenCalledTimes(3)
		expect(raw.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body })
		expect(raw.mock.calls[2]?.[1]).toMatchObject({ method: 'POST', body })
		expect(raw.mock.calls[2]?.[1]?.headers.cookie).toContain(
			'zeepcentral_access_token=next-access',
		)
	})

	test('propagates authenticated backend errors with response data', async () => {
		const data = { code: 123, message: 'nope' }
		vi.stubGlobal('$fetch', { raw: vi.fn().mockResolvedValue(response(422, data)) })
		vi.stubGlobal('useRuntimeConfig', () => ({
			public: { backendUrl: 'https://backend.example/' },
		}))
		vi.stubGlobal('getHeader', () => undefined)
		vi.stubGlobal('appendResponseHeader', vi.fn())
		vi.stubGlobal('createError', (input: object) => Object.assign(new Error(), input))

		await expect(
			fetchAuthenticatedBackend({}, '/favourite/remove', {
				method: 'POST',
				body: { hash: '0123456789ABCDEF0123456789ABCDEF' },
			}),
		).rejects.toMatchObject({
			statusCode: 422,
			statusMessage: 'Authenticated backend request failed',
			data,
		})
	})
})
