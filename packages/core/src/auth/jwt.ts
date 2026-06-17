import { createSigner, createVerifier } from 'fast-jwt'
import { config } from '../config'

export const jwtProvider = {
	gtr: 'gtr',
	steam: 'steam',
	discord: 'discord',
} as const

export type JwtProvider = (typeof jwtProvider)[keyof typeof jwtProvider]

type V1AccessTokenClaimsBase = {
	jti: `${string}-${string}-${string}-${string}-${string}`
	aud: string
	exp: number
	iat: number
	iss: string
	sub: string
	steamid: string
	provider: JwtProvider
}

type DiscordAccessTokenClaims = V1AccessTokenClaimsBase & {
	provider: typeof jwtProvider.discord
	discordid: string
}

type NonDiscordAccessTokenClaims = V1AccessTokenClaimsBase & {
	provider: typeof jwtProvider.gtr | typeof jwtProvider.steam
}

export type AccessTokenClaims = DiscordAccessTokenClaims | NonDiscordAccessTokenClaims

export type AccessTokenPayload = AccessTokenClaims & {
	// Convenience alias used throughout V3 services while preserving V1 on-wire claims.
	steamId: string
}

export type AccessTokenResponse = {
	accessToken: string
	accessTokenExpiry: bigint
}

export type RefreshTokenResponse = {
	refreshToken: string
	refreshTokenExpiry: bigint
}

export type GenerateAccessTokenInput = {
	provider: JwtProvider
	steamId: string
	discordId?: string
}

const signer = createSigner({
	key: config.jwt.secret,
	expiresIn: Math.floor(config.jwt.accessTtlMs / 1_000),
})

const verifier = createVerifier({
	key: config.jwt.secret,
})

function createV1Claims(input: GenerateAccessTokenInput): AccessTokenClaims {
	const nowSeconds = Math.floor(Date.now() / 1_000)

	const baseClaims: V1AccessTokenClaimsBase = {
		jti: crypto.randomUUID(),
		aud: config.jwt.audience,
		exp: nowSeconds + Math.floor(config.jwt.accessTtlMs / 1_000),
		iat: nowSeconds,
		iss: config.jwt.issuer,
		sub: input.steamId,
		steamid: input.steamId,
		provider: input.provider,
	}

	if (input.provider === jwtProvider.discord) {
		if (!input.discordId) {
			throw new Error('Discord provider requires discordId')
		}

		return {
			...baseClaims,
			provider: jwtProvider.discord,
			discordid: input.discordId,
		}
	}

	return baseClaims as NonDiscordAccessTokenClaims
}

export function createAccessToken(input: GenerateAccessTokenInput): string {
	return signer(createV1Claims(input))
}

export function generateAccessToken(input: GenerateAccessTokenInput): AccessTokenResponse {
	return {
		accessToken: createAccessToken(input),
		accessTokenExpiry: BigInt(Date.now() + config.jwt.accessTtlMs) / 1000n,
	}
}

export function generateRefreshToken(): RefreshTokenResponse {
	return {
		refreshToken: crypto.randomUUID(),
		refreshTokenExpiry: BigInt(Date.now() + config.jwt.refreshTtlMs) / 1000n,
	}
}

export function verifyAccessToken(token: string): AccessTokenPayload {
	const claims = verifier(token) as Partial<AccessTokenClaims>

	if (
		claims.aud !== config.jwt.audience ||
		claims.iss !== config.jwt.issuer ||
		!claims.sub ||
		!claims.provider ||
		!claims.steamid
	) {
		throw new Error('Invalid token claims')
	}

	if (claims.provider === jwtProvider.discord && !claims.discordid) {
		throw new Error('Invalid discord token claims')
	}

	return {
		...(claims as AccessTokenClaims),
		steamId: claims.steamid,
	}
}
