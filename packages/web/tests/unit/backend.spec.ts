import { describe, expect, test } from 'vitest'
import {
	accessTokenExpiresAt,
	accessTokenRefreshAt,
	cookieHeaderFromSetCookies,
	readSessionCookies,
} from '../../server/utils/backend'
import { isCrossOriginRequest } from '../../server/utils/request'

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

	test('requires the complete server-issued web auth cookie tuple', () => {
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
			readSessionCookies(
				'zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=access',
			),
		).toBeNull()
		expect(readSessionCookies('zeepcentral_refresh_token=%E0%A4%A')).toBeNull()
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
})
