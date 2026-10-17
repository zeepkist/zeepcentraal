import { getRouterParam } from 'nuxt/server'
import { describe, expect, it } from 'vitest'
import logout from '../../server/api/auth/logout.post'
import { assertSameOrigin } from '../../server/utils/request'
import { createRequestEvent } from '../support/request-event'

describe('portable server events', () => {
	it('preserves logout body and each cookie deletion header', () => {
		const event = createRequestEvent('https://zeepki.st/api/auth/logout', { method: 'POST' })
		expect(logout(event)).toBeNull()
		const cookies = event.res.headers.getSetCookie()
		expect(cookies).toHaveLength(4)
		for (const cookie of cookies) {
			expect(cookie).toContain('Domain=.zeepki.st')
			expect(cookie).toContain('Secure')
			expect(cookie).toContain('SameSite=Lax')
		}
		expect(cookies.find((cookie) => cookie.startsWith('zeepcentral_oauth_state='))).toContain(
			'Path=/auth/',
		)
	})
	it('rejects mismatched origins and cross-site requests with HTTP 403', () => {
		for (const headers of [
			{ origin: 'https://other.example.test' },
			{ 'sec-fetch-site': 'cross-site' },
		]) {
			const event = createRequestEvent('/api/auth/logout', { headers })
			expect(() => assertSameOrigin(event)).toThrowError(
				expect.objectContaining({ statusCode: 403 }),
			)
		}
		expect(() => assertSameOrigin(createRequestEvent())).not.toThrow()
	})
	it('preserves decoded route parameters explicitly', () => {
		const event = createRequestEvent('/downloads/release%20candidate')
		event.context.params = { channel: 'release%20candidate' }
		expect(getRouterParam(event, 'channel', { decode: true })).toBe('release candidate')
	})
})
