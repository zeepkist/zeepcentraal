import { describe, expect, test } from 'vitest'
import { webAuthCookieDomain, webAuthCookieNames } from '../../server/utils/auth-cookies'

describe('web logout cookies', () => {
	test('clears every persistent authentication cookie', () => {
		expect(webAuthCookieNames).toEqual([
			'zeepcentral_access_token',
			'zeepcentral_refresh_token',
			'zeepcentral_steam_id',
		])
	})

	test('matches production cookie domain but keeps local cookies host-only', () => {
		expect(webAuthCookieDomain('zeepki.st')).toBe('.zeepki.st')
		expect(webAuthCookieDomain('www.zeepki.st')).toBe('.zeepki.st')
		expect(webAuthCookieDomain('localhost')).toBeUndefined()
	})
})
