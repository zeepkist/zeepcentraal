import { expect, test } from 'bun:test'
import { sanitizeTelemetryUrl } from './withSpanEnrichment'

test('sanitizeTelemetryUrl redacts temporary auth credentials but keeps user identifiers', () => {
	const sanitized = new URL(
		sanitizeTelemetryUrl(
			'https://api.example/auth/steam/callback?openid.identity=steam-user&openid.sig=secret&openid.response_nonce=nonce&openid.return_to=https%3A%2F%2Fapi.example%2Fauth%2Fsteam%2Fcallback%3Fstate%3Dsecret&state=state&discord_id=123',
		),
	)

	expect(sanitized.searchParams.get('openid.identity')).toBe('steam-user')
	expect(sanitized.searchParams.get('discord_id')).toBe('123')
	expect(sanitized.searchParams.get('openid.sig')).toBe('[REDACTED]')
	expect(sanitized.searchParams.get('openid.response_nonce')).toBe('[REDACTED]')
	expect(sanitized.searchParams.get('openid.return_to')).toBe('[REDACTED]')
	expect(sanitized.searchParams.get('state')).toBe('[REDACTED]')
})
