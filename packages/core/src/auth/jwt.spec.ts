import { expect, test } from 'bun:test'

process.env.DATABASE_URL =
	process.env.DATABASE_URL ?? 'postgres://zeepkist:password@localhost:5432/zeepkist'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'x'.repeat(32)
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'zeepki.st'
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? 'https://zeepki.st'
process.env.JWT_ACCESS_TTL = '5m'
process.env.JWT_REFRESH_TTL = '7d'
process.env.TRIGGER_JOB_TOKEN = process.env.TRIGGER_JOB_TOKEN ?? 'trigger-token'

const { generateAccessToken, verifyAccessToken, jwtProvider } = await import('./jwt')

function decodeJwtPayload(token: string) {
	const parts = token.split('.')
	if (parts.length !== 3) {
		throw new Error('Invalid JWT format')
	}
	const encodedPayload = parts[1]
	if (!encodedPayload) {
		throw new Error('Missing JWT payload')
	}

	const payload = JSON.parse(
		Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
	) as Record<string, unknown>
	return payload
}

test('generateAccessToken emits V1-compatible claims for gtr provider', () => {
	const { accessToken } = generateAccessToken({
		provider: jwtProvider.gtr,
		steamId: '12345678901234567',
	})

	const payload = decodeJwtPayload(accessToken)
	expect(payload.aud).toBe('zeepki.st')
	expect(payload.iss).toBe('https://zeepki.st')
	expect(payload.sub).toBe('12345678901234567')
	expect(payload.steamid).toBe('12345678901234567')
	expect(payload.provider).toBe('gtr')
	expect(typeof payload.jti).toBe('string')
	expect(typeof payload.iat).toBe('number')
	expect(typeof payload.exp).toBe('number')
})

test('generateAccessToken emits discordid for discord provider', () => {
	const { accessToken } = generateAccessToken({
		provider: jwtProvider.discord,
		steamId: '12345678901234567',
		discordId: '76561198000000000',
	})

	const payload = decodeJwtPayload(accessToken)
	expect(payload.provider).toBe('discord')
	expect(payload.discordid).toBe('76561198000000000')
})

test('verifyAccessToken returns normalized steamId alias and validated claims', () => {
	const { accessToken } = generateAccessToken({
		provider: jwtProvider.steam,
		steamId: '12345678901234567',
	})

	const verified = verifyAccessToken(accessToken)
	expect(verified.steamId).toBe('12345678901234567')
	expect(verified.steamid).toBe('12345678901234567')
	expect(verified.provider).toBe('steam')
	expect(verified.aud).toBe('zeepki.st')
	expect(verified.iss).toBe('https://zeepki.st')
})
