import { describe, expect, test } from 'vitest'
import { accessTokenRefreshAt } from '../../server/utils/backend'
import { isCrossOriginRequest } from '../../server/utils/request'

describe('web server auth and request guards', () => {
	test('schedules access refresh one minute before JWT expiry', () => {
		const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000 })).toString('base64url')
		expect(accessTokenRefreshAt(`zeepcentral_access_token=x.${payload}.x`)).toBe(
			1_999_999_940_000,
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
