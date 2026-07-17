import { timingSafeEqual } from 'node:crypto'
import {
	authenticateSteamUser,
	COOKIES,
	config,
	generateAccessToken,
	generateRefreshToken,
	getDiscordAccessToken,
	getDiscordRedirectUrl,
	getDiscordUser,
	getSteamRedirectUrl,
	isSteamLoginSignatureValid,
	jwtProvider,
	parseCookieHeader,
} from '@zeepkist/core'
import {
	getOrInsertUser,
	getUser,
	getUserByDiscordId,
	insertAuth,
	rotateAuth,
} from '@zeepkist/database/services'
import { setActiveSpanAttributes } from '@zeepkist/telemetry'
import { Elysia, t } from 'elysia'
import { OPENAPI_TAG } from '../../openapi'
import { withModVersionGuard } from '../../plugins/withModVersionGuard'
import { withRateLimit } from '../../plugins/withRateLimit'
import { handleV1Error, V1_ERROR_CODES } from '../../v1Errors'

function cookieDomain() {
	const backendUrl = config.backendUrl
	const frontendUrl = config.frontendUrl
	const isLocal = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')
	return {
		backendUrl,
		frontendUrl,
		domain: isLocal ? null : `.${new URL(frontendUrl).hostname}`,
		secure: !isLocal,
	}
}

function buildSetCookieHeaders({
	accessToken,
	accessTokenExpiry,
	refreshToken,
	refreshTokenExpiry,
	steamId,
}: {
	accessToken: string
	accessTokenExpiry: bigint
	refreshToken: string
	refreshTokenExpiry: bigint
	steamId: string
}) {
	const { domain, secure } = cookieDomain()
	const expiresIn = (expiry: bigint) => Math.max(Number(expiry * 1000n) - Date.now(), 0)
	const domainAttribute = domain ? `Domain=${domain}; ` : ''
	const secureAttribute = secure ? 'Secure; ' : ''

	const accessMaxAge = Math.round(expiresIn(accessTokenExpiry) / 1000)
	const refreshMaxAge = Math.round(expiresIn(refreshTokenExpiry) / 1000)
	const accessCookie = `${COOKIES.AccessToken}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=${accessMaxAge}; ${domainAttribute}SameSite=Lax; ${secureAttribute}HttpOnly`
	const refreshCookie = `${COOKIES.RefreshToken}=${encodeURIComponent(refreshToken)}; Path=/; Max-Age=${refreshMaxAge}; ${domainAttribute}SameSite=Lax; ${secureAttribute}HttpOnly`
	const steamIdCookie = `${COOKIES.SteamId}=${encodeURIComponent(steamId)}; Path=/; Max-Age=${refreshMaxAge}; ${domainAttribute}SameSite=Lax; ${secureAttribute}`

	return [accessCookie, refreshCookie, steamIdCookie]
}

function stateCookie(value: string, maxAge: number) {
	const { secure } = cookieDomain()
	return `${COOKIES.OAuthState}=${encodeURIComponent(value)}; Path=/auth/; Max-Age=${maxAge}; SameSite=Lax; ${secure ? 'Secure; ' : ''}HttpOnly`
}

function validState(headers: Record<string, string | undefined>, value?: string): boolean {
	const cookieState = parseCookieHeader(headers.cookie)[COOKIES.OAuthState]
	if (!cookieState || !value) {
		return false
	}
	const expected = Buffer.from(cookieState)
	const actual = Buffer.from(value)
	return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function redirectResponse(url: string, cookies?: string[]) {
	const headers = new Headers({ Location: url })
	for (const cookie of cookies ?? []) {
		headers.append('Set-Cookie', cookie)
	}
	return new Response(null, { status: 302, headers })
}

function emptyJsonResponse(status: number, body?: unknown, cookies?: string[]) {
	const headers = new Headers()
	if (cookies) {
		for (const cookie of cookies) {
			headers.append('Set-Cookie', cookie)
		}
	}
	if (body === undefined) {
		return new Response(null, { status, headers })
	}
	headers.set('Content-Type', 'application/json')
	return new Response(JSON.stringify(body), { status, headers })
}

function errorResponse(status: number, code: number) {
	return emptyJsonResponse(status, handleV1Error(code))
}

const gtrAuthRoutes = new Elysia()
	.use(withRateLimit('auth'))
	.use(withModVersionGuard)
	.post(
		'/login',
		async ({ body }) => {
			const { ModVersion, SteamId, AuthenticationTicket } = body
			if (!ModVersion || !SteamId || !AuthenticationTicket) {
				return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_REQUIRED_FIELDS)
			}

			const authResponse = await authenticateSteamUser(AuthenticationTicket)
			if (!authResponse.success) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_STEAM_AUTHENTICATION_FAILED)
			}
			if (authResponse.steamId !== SteamId) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_STEAM_ID_MISMATCH)
			}

			const user = await getOrInsertUser(BigInt(SteamId))
			if (!user) {
				return errorResponse(500, V1_ERROR_CODES.INTERNAL_SERVER_ERROR)
			}
			if (user.banned) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}
			const { accessToken, accessTokenExpiry } = generateAccessToken({
				provider: jwtProvider.gtr,
				steamId: SteamId,
			})
			const { refreshToken, refreshTokenExpiry } = generateRefreshToken()

			await insertAuth({
				idUser: user.id,
				accessToken,
				accessTokenExpiry,
				refreshToken,
				refreshTokenExpiry,
				type: 0,
				provider: jwtProvider.gtr,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})

			return emptyJsonResponse(200, {
				AccessToken: accessToken,
				AccessTokenExpiry: Number(accessTokenExpiry),
				RefreshToken: refreshToken,
				RefreshTokenExpiry: Number(refreshTokenExpiry),
			})
		},
		{
			body: t.Object({
				ModVersion: t.String({ description: 'Installed GTR semantic version.' }),
				SteamId: t.String({ description: 'SteamID64 belonging to the player.' }),
				AuthenticationTicket: t.String({
					description: 'Steam authentication session ticket encoded by the GTR client.',
				}),
			}),
			detail: {
				operationId: 'loginGtr',
				summary: 'Sign in with a Steam authentication ticket',
				description:
					'Validates a Steam authentication ticket and returns a GTR access-token and refresh-token pair.',
				tags: [OPENAPI_TAG.auth],
			},
		},
	)
	.post(
		'/refresh',
		async ({ body }) => {
			const { ModVersion, SteamId, LoginToken, RefreshToken } = body
			if (!ModVersion || !SteamId || !LoginToken || !RefreshToken) {
				return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_REQUIRED_FIELDS)
			}

			const user = await getUser(SteamId)
			if (!user) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_USER_NOT_FOUND)
			}
			if (user.banned) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			const { accessToken, accessTokenExpiry } = generateAccessToken({
				provider: jwtProvider.gtr,
				steamId: SteamId,
			})
			const { refreshToken, refreshTokenExpiry } = generateRefreshToken()

			const rotated = await rotateAuth(user.id, RefreshToken, {
				idUser: user.id,
				accessToken,
				accessTokenExpiry,
				refreshToken,
				refreshTokenExpiry,
				type: 0,
				provider: jwtProvider.gtr,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})
			if (!rotated) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			return emptyJsonResponse(200, {
				AccessToken: accessToken,
				AccessTokenExpiry: Number(accessTokenExpiry),
				RefreshToken: refreshToken,
				RefreshTokenExpiry: Number(refreshTokenExpiry),
			})
		},
		{
			body: t.Object({
				ModVersion: t.String({ description: 'Installed GTR semantic version.' }),
				SteamId: t.String({ description: 'SteamID64 belonging to the player.' }),
				LoginToken: t.String({
					description: 'Current GTR login token retained for V1 client compatibility.',
				}),
				RefreshToken: t.String({ description: 'Current GTR refresh token.' }),
			}),
			detail: {
				operationId: 'refreshGtrSession',
				summary: 'Refresh a GTR session',
				description:
					'Rotates the supplied GTR refresh token and returns a new access-token and refresh-token pair.',
				tags: [OPENAPI_TAG.auth],
			},
		},
	)

export const authRoutes = new Elysia({ prefix: '/auth' })
	.use(gtrAuthRoutes)
	.use(withRateLimit('auth'))
	.get(
		'/discord/redirect',
		() => {
			const state = crypto.randomUUID()
			return redirectResponse(getDiscordRedirectUrl(state), [stateCookie(state, 300)])
		},
		{
			detail: {
				operationId: 'startDiscordLogin',
				summary: 'Start Discord sign-in',
				description:
					'Sets a short-lived OAuth state cookie and redirects the browser to Discord.',
				tags: [OPENAPI_TAG.auth],
			},
		},
	)
	.get(
		'/discord/callback',
		async ({ query, headers }) => {
			const code = query.code as string | undefined
			const state = query.state as string | undefined
			if (!code || !validState(headers, state)) {
				return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_TOKEN)
			}

			const discordAccessToken = await getDiscordAccessToken(code)
			if (!discordAccessToken) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			const discordUser = await getDiscordUser(discordAccessToken)
			if (!discordUser) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			const user = await getUserByDiscordId(discordUser.id)
			if (!user?.steamId) {
				return errorResponse(400, V1_ERROR_CODES.AUTH_DISCORD_NOT_LINKED)
			}
			if (user.banned) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}
			setActiveSpanAttributes({
				'user.discord_id': discordUser.id,
				'user.steam_id': user.steamId.toString(),
			})

			const { accessToken, accessTokenExpiry } = generateAccessToken({
				provider: jwtProvider.discord,
				steamId: user.steamId.toString(),
				discordId: discordUser.id,
			})
			const { refreshToken, refreshTokenExpiry } = generateRefreshToken()
			const cookies = [
				...buildSetCookieHeaders({
					accessToken,
					accessTokenExpiry,
					refreshToken,
					refreshTokenExpiry,
					steamId: user.steamId.toString(),
				}),
			]

			await insertAuth({
				idUser: user.id,
				accessToken,
				accessTokenExpiry,
				refreshToken,
				refreshTokenExpiry,
				type: 0,
				provider: jwtProvider.discord,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})

			return redirectResponse(new URL('/?auth=callback', cookieDomain().frontendUrl).href, [
				...cookies,
				stateCookie('', 0),
			])
		},
		{
			detail: {
				operationId: 'completeDiscordLogin',
				summary: 'Complete Discord sign-in',
				description:
					'Validates the Discord OAuth callback, creates browser session cookies, and redirects to ZeepCentraal.',
				tags: [OPENAPI_TAG.auth],
			},
		},
	)
	.get(
		'/steam/redirect',
		() => {
			const state = crypto.randomUUID()
			return redirectResponse(getSteamRedirectUrl(state), [stateCookie(state, 300)])
		},
		{
			detail: {
				operationId: 'startSteamLogin',
				summary: 'Start Steam sign-in',
				description:
					'Sets a short-lived OAuth state cookie and redirects the browser to Steam.',
				tags: [OPENAPI_TAG.auth],
			},
		},
	)
	.get(
		'/steam/callback',
		async ({ query, headers }) => {
			const state = query.state as string | undefined
			if (!validState(headers, state)) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}
			const steamQuery = query as unknown as Parameters<typeof isSteamLoginSignatureValid>[0]
			if (!(await isSteamLoginSignatureValid(steamQuery))) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			const steamIdentity = query['openid.identity'] as string | undefined
			const steamId = steamIdentity?.split('/').pop()
			if (!steamId) {
				return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_TOKEN)
			}

			const user = await getOrInsertUser(BigInt(steamId))
			if (!user) {
				return errorResponse(500, V1_ERROR_CODES.INTERNAL_SERVER_ERROR)
			}
			if (user.banned) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}
			setActiveSpanAttributes({ 'user.steam_id': steamId })
			const { accessToken, accessTokenExpiry } = generateAccessToken({
				provider: jwtProvider.steam,
				steamId,
			})
			const { refreshToken, refreshTokenExpiry } = generateRefreshToken()
			const cookies = [
				...buildSetCookieHeaders({
					accessToken,
					accessTokenExpiry,
					refreshToken,
					refreshTokenExpiry,
					steamId,
				}),
			]

			await insertAuth({
				idUser: user.id,
				accessToken,
				accessTokenExpiry,
				refreshToken,
				refreshTokenExpiry,
				type: 0,
				provider: jwtProvider.steam,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})

			return redirectResponse(new URL('/?auth=callback', cookieDomain().frontendUrl).href, [
				...cookies,
				stateCookie('', 0),
			])
		},
		{
			detail: {
				operationId: 'completeSteamLogin',
				summary: 'Complete Steam sign-in',
				description:
					'Validates the Steam OpenID callback, creates browser session cookies, and redirects to ZeepCentraal.',
				tags: [OPENAPI_TAG.auth],
			},
		},
	)
	.post(
		'/web/refresh',
		async ({ headers }) => {
			const cookies = Object.fromEntries(
				(headers.cookie ?? '')
					.split(';')
					.map((item) => item.trim())
					.filter(Boolean)
					.map((item) => {
						const [key, ...rest] = item.split('=')
						return [key, decodeURIComponent(rest.join('='))]
					}),
			) as Record<string, string>

			const cookieAccessToken = cookies[COOKIES.AccessToken]
			const cookieRefreshToken = cookies[COOKIES.RefreshToken]
			const cookieSteamId = cookies[COOKIES.SteamId]

			if (!cookieAccessToken || !cookieRefreshToken || !cookieSteamId) {
				return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_TOKEN)
			}

			const user = await getUser(cookieSteamId)
			if (!user) {
				return errorResponse(404, V1_ERROR_CODES.AUTH_USER_NOT_FOUND)
			}
			if (user.banned) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			const { accessToken, accessTokenExpiry } = generateAccessToken({
				provider: jwtProvider.steam,
				steamId: cookieSteamId,
			})
			const { refreshToken, refreshTokenExpiry } = generateRefreshToken()
			const nextCookies = [
				...buildSetCookieHeaders({
					accessToken,
					accessTokenExpiry,
					refreshToken,
					refreshTokenExpiry,
					steamId: cookieSteamId,
				}),
			]

			const rotated = await rotateAuth(user.id, cookieRefreshToken, {
				idUser: user.id,
				accessToken,
				accessTokenExpiry,
				refreshToken,
				refreshTokenExpiry,
				type: 0,
				provider: jwtProvider.steam,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})
			if (!rotated) {
				return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN)
			}

			return emptyJsonResponse(200, undefined, nextCookies)
		},
		{
			detail: {
				operationId: 'refreshWebSession',
				summary: 'Refresh a browser session',
				description:
					'Rotates browser access and refresh cookies. Requires the complete ZeepCentraal session cookie set.',
				security: [{ webSession: [] }],
				tags: [OPENAPI_TAG.auth],
			},
		},
	)
