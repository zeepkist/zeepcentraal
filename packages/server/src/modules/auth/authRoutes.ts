import {
	authenticateSteamUser,
	generateAccessToken,
	generateRefreshToken,
	getDiscordAccessToken,
	getDiscordRedirectUrl,
	getDiscordUser,
	getSteamRedirectUrl,
	isSteamLoginSignatureValid,
	jwtProvider,
	COOKIES,
} from '@zeepkist/core';
import {
	deleteAuthByRefreshToken,
	getAuthByUserAndRefreshToken,
	getOrInsertUser,
	getUser,
	getUserByDiscordId,
	insertAuth,
} from '@zeepkist/database/services';
import { t, Elysia } from 'elysia';
import { withModVersionGuard } from '../../plugins/withModVersionGuard';
import { V1_ERROR_CODES, handleV1Error } from '../../v1Errors';

function cookieDomain() {
	const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
	const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
	const isLocal = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
	return {
		backendUrl,
		frontendUrl,
		domain: isLocal ? 'localhost' : `.${new URL(frontendUrl).hostname}`,
	};
}

function buildSetCookieHeaders({
	accessToken,
	accessTokenExpiry,
	refreshToken,
	refreshTokenExpiry,
	steamId,
}: {
	accessToken: string;
	accessTokenExpiry: bigint;
	refreshToken: string;
	refreshTokenExpiry: bigint;
	steamId: string;
}) {
	const { domain } = cookieDomain();
	const expiresIn = (expiry: bigint) => Math.max(Number(expiry * 1000n) - Date.now(), 0);

	const accessMaxAge = Math.round(expiresIn(accessTokenExpiry) / 1000);
	const refreshMaxAge = Math.round(expiresIn(refreshTokenExpiry) / 1000);
	const accessCookie = `${COOKIES.AccessToken}=${encodeURIComponent(accessToken)}; Path=/; Max-Age=${accessMaxAge}; Domain=${domain}; SameSite=Lax; ${domain === 'localhost' ? '' : 'Secure; '}HttpOnly`;
	const refreshCookie = `${COOKIES.RefreshToken}=${encodeURIComponent(refreshToken)}; Path=/; Max-Age=${refreshMaxAge}; Domain=${domain}; SameSite=Lax; ${domain === 'localhost' ? '' : 'Secure; '}HttpOnly`;
	const steamIdCookie = `${COOKIES.SteamId}=${encodeURIComponent(steamId)}; Path=/; Max-Age=${refreshMaxAge}; Domain=${domain}; SameSite=Lax; ${domain === 'localhost' ? '' : 'Secure; '}`;

	return [accessCookie, refreshCookie, steamIdCookie];
}

function redirectResponse(url: string, cookies?: string[]) {
	const headers = new Headers({ Location: url });
	for (const cookie of cookies ?? []) {
		headers.append('Set-Cookie', cookie);
	}
	return new Response(null, { status: 302, headers });
}

function emptyJsonResponse(status: number, body?: unknown, cookies?: string[]) {
	const headers = new Headers();
	if (cookies) {
		for (const cookie of cookies) {
			headers.append('Set-Cookie', cookie);
		}
	}
	if (body === undefined) {
		return new Response(null, { status, headers });
	}
	headers.set('Content-Type', 'application/json');
	return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(status: number, code: number) {
	return emptyJsonResponse(status, handleV1Error(code));
}

const gtrAuthRoutes = new Elysia()
	.use(withModVersionGuard)
	.post('/login', async ({ body }) => {
		const { ModVersion, SteamId, AuthenticationTicket } = body;
		if (!ModVersion || !SteamId || !AuthenticationTicket) {
			return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_REQUIRED_FIELDS);
		}

		const authResponse = await authenticateSteamUser(AuthenticationTicket);
		if (!authResponse.success) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_STEAM_AUTHENTICATION_FAILED);
		}
		if (authResponse.steamId !== SteamId) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_STEAM_ID_MISMATCH);
		}

		const user = await getOrInsertUser(BigInt(SteamId), SteamId);
		if (!user) {
			return errorResponse(500, V1_ERROR_CODES.INTERNAL_SERVER_ERROR);
		}
		const { accessToken, accessTokenExpiry } = generateAccessToken({
			provider: jwtProvider.gtr,
			steamId: SteamId,
		});
		const { refreshToken, refreshTokenExpiry } = generateRefreshToken();

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
		});

		return emptyJsonResponse(200, {
			AccessToken: accessToken,
			AccessTokenExpiry: Number(accessTokenExpiry),
			RefreshToken: refreshToken,
			RefreshTokenExpiry: Number(refreshTokenExpiry),
		});
	}, {
		body: t.Object({
			ModVersion: t.String(),
			SteamId: t.String(),
			AuthenticationTicket: t.String(),
		}),
	})
	.post('/refresh', async ({ body }) => {
		const { ModVersion, SteamId, LoginToken, RefreshToken } = body;
		if (!ModVersion || !SteamId || !LoginToken || !RefreshToken) {
			return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_REQUIRED_FIELDS);
		}

		const user = await getUser(SteamId);
		if (!user) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_USER_NOT_FOUND);
		}

		const auth = await getAuthByUserAndRefreshToken(user.id, RefreshToken);
		if (!auth || (auth.refreshTokenExpiry !== null && Date.now() > Number(auth.refreshTokenExpiry * 1000n))) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN);
		}

		await deleteAuthByRefreshToken(RefreshToken);

		const { accessToken, accessTokenExpiry } = generateAccessToken({
			provider: jwtProvider.gtr,
			steamId: SteamId,
		});
		const { refreshToken, refreshTokenExpiry } = generateRefreshToken();

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
		});

		return emptyJsonResponse(200, {
			AccessToken: accessToken,
			AccessTokenExpiry: Number(accessTokenExpiry),
			RefreshToken: refreshToken,
			RefreshTokenExpiry: Number(refreshTokenExpiry),
		});
	}, {
		body: t.Object({
			ModVersion: t.String(),
			SteamId: t.String(),
			LoginToken: t.String(),
			RefreshToken: t.String(),
		}),
	});

export const authRoutes = new Elysia({ prefix: '/auth' })
	.use(gtrAuthRoutes)
	.get('/discord/redirect', () => redirectResponse(getDiscordRedirectUrl()))
	.get('/discord/callback', async ({ query }) => {
		const code = query.code as string | undefined;
		if (!code) {
			return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_TOKEN);
		}

		const discordAccessToken = await getDiscordAccessToken(code);
		if (!discordAccessToken) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN);
		}

		const discordUser = await getDiscordUser(discordAccessToken);
		if (!discordUser) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN);
		}

		const user = await getUserByDiscordId(discordUser.id);
		if (!user || !user.steamId) {
			return errorResponse(400, V1_ERROR_CODES.AUTH_DISCORD_NOT_LINKED);
		}

		const { accessToken, accessTokenExpiry } = generateAccessToken({
			provider: jwtProvider.discord,
			steamId: user.steamId.toString(),
			discordId: discordUser.id,
		});
		const { refreshToken, refreshTokenExpiry } = generateRefreshToken();
		const cookies = buildSetCookieHeaders({
			accessToken,
			accessTokenExpiry,
			refreshToken,
			refreshTokenExpiry,
			steamId: user.steamId.toString(),
		});

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
		});

		return redirectResponse(new URL('/auth/callback', cookieDomain().frontendUrl).href, cookies);
	})
	.get('/steam/redirect', () => redirectResponse(getSteamRedirectUrl()))
	.get('/steam/callback', async ({ query }) => {
		const steamQuery = query as unknown as Parameters<typeof isSteamLoginSignatureValid>[0];
		if (!(await isSteamLoginSignatureValid(steamQuery))) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN);
		}

		const steamIdentity = query['openid.identity'] as string | undefined;
		const steamId = steamIdentity?.split('/').pop();
		if (!steamId) {
			return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_TOKEN);
		}

		const user = await getOrInsertUser(BigInt(steamId));
		if (!user) {
			return errorResponse(500, V1_ERROR_CODES.INTERNAL_SERVER_ERROR);
		}
		const { accessToken, accessTokenExpiry } = generateAccessToken({
			provider: jwtProvider.steam,
			steamId,
		});
		const { refreshToken, refreshTokenExpiry } = generateRefreshToken();
		const cookies = buildSetCookieHeaders({
			accessToken,
			accessTokenExpiry,
			refreshToken,
			refreshTokenExpiry,
			steamId,
		});

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
		});

		return redirectResponse(new URL('/auth/callback', cookieDomain().frontendUrl).href, cookies);
	})
	.post('/web/refresh', async ({ headers }) => {
		const cookies = Object.fromEntries(
			(headers.cookie ?? '')
				.split(';')
				.map((item) => item.trim())
				.filter(Boolean)
				.map((item) => {
					const [key, ...rest] = item.split('=');
					return [key, decodeURIComponent(rest.join('='))];
				}),
		) as Record<string, string>;

		const cookieAccessToken = cookies[COOKIES.AccessToken];
		const cookieRefreshToken = cookies[COOKIES.RefreshToken];
		const cookieSteamId = cookies[COOKIES.SteamId];

		if (!cookieAccessToken || !cookieRefreshToken || !cookieSteamId) {
			return errorResponse(400, V1_ERROR_CODES.AUTH_MISSING_TOKEN);
		}

		const user = await getUser(cookieSteamId);
		if (!user) {
			return errorResponse(404, V1_ERROR_CODES.AUTH_USER_NOT_FOUND);
		}

		const auth = await getAuthByUserAndRefreshToken(user.id, cookieRefreshToken);
		if (!auth || (auth.refreshTokenExpiry !== null && Date.now() > Number(auth.refreshTokenExpiry * 1000n))) {
			return errorResponse(401, V1_ERROR_CODES.AUTH_INVALID_TOKEN);
		}

		await deleteAuthByRefreshToken(cookieRefreshToken);

		const { accessToken, accessTokenExpiry } = generateAccessToken({
			provider: jwtProvider.steam,
			steamId: cookieSteamId,
		});
		const { refreshToken, refreshTokenExpiry } = generateRefreshToken();
		const nextCookies = buildSetCookieHeaders({
			accessToken,
			accessTokenExpiry,
			refreshToken,
			refreshTokenExpiry,
			steamId: cookieSteamId,
		});

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
		});

		return emptyJsonResponse(200, undefined, nextCookies);
	});
