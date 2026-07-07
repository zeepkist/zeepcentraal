import { describe, expect, test } from 'vitest'
import { authRefreshUrl, discordRedirectUrl, steamRedirectUrl, userUrl } from '../../app/utils/auth'

describe('auth URL helpers', () => {
	test('targets backend OAuth and session routes', () => {
		const backendUrl = 'http://localhost:3000'

		expect(steamRedirectUrl(backendUrl)).toBe('http://localhost:3000/auth/steam/redirect')
		expect(discordRedirectUrl(backendUrl)).toBe('http://localhost:3000/auth/discord/redirect')
		expect(authRefreshUrl(backendUrl)).toBe('http://localhost:3000/auth/web/refresh')
		expect(userUrl(backendUrl)).toBe('http://localhost:3000/user')
	})
})
