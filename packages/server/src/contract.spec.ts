import { beforeEach, expect, mock, test } from 'bun:test'

process.env.BACKEND_URL = 'http://localhost:3000'
process.env.FRONTEND_URL = 'http://localhost:5173'

type MockUser = {
	id: number
	steamId: bigint
	steamName: string
	banned: boolean
	discordId: bigint | null
	dateCreated: string
	dateUpdated: string
}

type MockAuth = {
	id: number
	idUser: number
	accessToken: string
	accessTokenExpiry: bigint
	refreshToken: string
	refreshTokenExpiry: bigint
	type: number
	provider: string
	dateCreated: string
	dateUpdated: string
}

const state = {
	versionOutdated: false,
	steamAuthSuccess: true,
	steamAuthSteamId: '12345678901234567',
	discordAccessToken: 'discord-access-token',
	discordUser: { id: '76561198000000000' },
	steamSignatureValid: true,
	steamUser: { steamid: '12345678901234567', personaname: 'Zeep' },
	levelExists: true,
	accessTokenCounter: 0,
	refreshTokenCounter: 0,
	insertAuthCalls: [] as Array<Record<string, unknown>>,
	deletedRefreshTokens: [] as string[],
	jobCalls: [] as Array<{ task: string; options: Record<string, unknown> }>,
	updatedDiscordIds: [] as Array<{ steamId: string; discordId: bigint | null }>,
	userBySteamId: {
		id: 1,
		steamId: 12345678901234567n,
		steamName: 'Zeep',
		banned: false,
		discordId: 76561198000000000n,
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	} as MockUser | null,
	userByDiscordId: {
		id: 1,
		steamId: 12345678901234567n,
		steamName: 'Zeep',
		banned: false,
		discordId: 76561198000000000n,
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	} as MockUser | null,
	refreshAuth: {
		id: 9,
		idUser: 1,
		accessToken: 'existing-access',
		accessTokenExpiry: 1_900_000_000n,
		refreshToken: 'existing-refresh',
		refreshTokenExpiry: 1_900_000_000n,
		type: 0,
		provider: 'gtr',
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	} as MockAuth | null,
	level: {
		id: 10,
		hash: '61C096367AFC76A1D2E8024AA638F516912444CC',
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	},
	record: {
		id: 20,
		idUser: 1,
		idLevel: 10,
		time: 12.345678,
		gameVersion: '1.0.0',
		modVersion: '1.0.0',
		splits: [1.2, 5.6],
		speeds: [100, 200],
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	},
	recordMedia: {
		id: 30,
		idRecord: 20,
		ghostUrl: 'inline://ghost',
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	},
	vote: {
		id: 40,
		idUser: 1,
		idLevel: 10,
		value: 2,
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	},
}

function resetState() {
	state.versionOutdated = false
	state.steamAuthSuccess = true
	state.steamAuthSteamId = '12345678901234567'
	state.discordAccessToken = 'discord-access-token'
	state.discordUser = { id: '76561198000000000' }
	state.steamSignatureValid = true
	state.steamUser = { steamid: '12345678901234567', personaname: 'Zeep' }
	state.levelExists = true
	state.accessTokenCounter = 0
	state.refreshTokenCounter = 0
	state.insertAuthCalls = []
	state.deletedRefreshTokens = []
	state.jobCalls = []
	state.updatedDiscordIds = []
	state.userBySteamId = {
		id: 1,
		steamId: 12345678901234567n,
		steamName: 'Zeep',
		banned: false,
		discordId: 76561198000000000n,
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
	state.userByDiscordId = {
		id: 1,
		steamId: 12345678901234567n,
		steamName: 'Zeep',
		banned: false,
		discordId: 76561198000000000n,
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
	state.refreshAuth = {
		id: 9,
		idUser: 1,
		accessToken: 'existing-access',
		accessTokenExpiry: 1_900_000_000n,
		refreshToken: 'existing-refresh',
		refreshTokenExpiry: 1_900_000_000n,
		type: 0,
		provider: 'gtr',
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
	state.level = {
		id: 10,
		hash: '61C096367AFC76A1D2E8024AA638F516912444CC',
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
	state.record = {
		id: 20,
		idUser: 1,
		idLevel: 10,
		time: 12.345678,
		gameVersion: '1.0.0',
		modVersion: '1.0.0',
		splits: [1.2, 5.6],
		speeds: [100, 200],
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
	state.recordMedia = {
		id: 30,
		idRecord: 20,
		ghostUrl: 'inline://ghost',
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
	state.vote = {
		id: 40,
		idUser: 1,
		idLevel: 10,
		value: 2,
		dateCreated: new Date().toISOString(),
		dateUpdated: new Date().toISOString(),
	}
}

mock.module('@zeepkist/core', () => ({
	COOKIES: {
		AccessToken: 'zeepcentral_access_token',
		RefreshToken: 'zeepcentral_refresh_token',
		SteamId: 'zeepcentral_steam_id',
	},
	config: {
		api: { host: '0.0.0.0', port: 3000 },
		job: { triggerToken: 'job-secret' },
		jwt: {
			secret: 'x'.repeat(32),
			audience: 'zeepki.st',
			issuer: 'https://zeepki.st',
			accessTtlMs: 900_000,
			refreshTtlMs: 2_592_000_000,
		},
		backendUrl: 'http://localhost:3000',
		frontendUrl: 'http://localhost:5173',
		discord: {
			clientId: 'discord-client-id',
			clientSecret: 'discord-client-secret',
			redirectUri: 'http://localhost:3000/auth/discord/callback',
		},
		steam: {
			appId: '1440670',
			apiKey: 'steam-api-key',
		},
		otel: { serviceName: 'zeepcentraal-api', collectorUrl: 'http://localhost:4317' },
	},
	jwtProvider: {
		gtr: 'gtr',
		steam: 'steam',
		discord: 'discord',
	},
	generateAccessToken: ({ provider, steamId }: { provider: string; steamId: string }) => {
		state.accessTokenCounter += 1
		return {
			accessToken: `${provider}:${steamId}:access:${state.accessTokenCounter}`,
			accessTokenExpiry: BigInt(1_900_000_000 + state.accessTokenCounter),
		}
	},
	generateRefreshToken: () => {
		state.refreshTokenCounter += 1
		return {
			refreshToken: `refresh:${state.refreshTokenCounter}`,
			refreshTokenExpiry: BigInt(1_900_000_100 + state.refreshTokenCounter),
		}
	},
	authenticateSteamUser: async () =>
		state.steamAuthSuccess
			? { success: true, steamId: state.steamAuthSteamId }
			: { success: false, error: 'Steam auth failed' },
	getDiscordRedirectUrl: () => 'https://discord.com/oauth2/authorize?mock=1',
	getDiscordAccessToken: async () => state.discordAccessToken,
	getDiscordUser: async () => state.discordUser,
	getSteamRedirectUrl: () => 'https://steamcommunity.com/openid/login?mock=1',
	isSteamLoginSignatureValid: async () => state.steamSignatureValid,
	verifyAccessToken: (token: string) => {
		if (token === 'gtr-valid') {
			return { steamId: '12345678901234567', steamid: '12345678901234567', provider: 'gtr' }
		}
		if (token === 'steam-valid') {
			return {
				steamId: '12345678901234567',
				steamid: '12345678901234567',
				provider: 'steam',
			}
		}
		if (token === 'discord-valid') {
			return {
				steamId: '12345678901234567',
				steamid: '12345678901234567',
				provider: 'discord',
				discordid: '76561198000000000',
			}
		}
		throw new Error('invalid token')
	},
	getSteamUser: async (steamId: string) => ({ steamid: steamId, personaname: 'Zeep' }),
}))

mock.module('@zeepkist/database', () => ({
	db: {},
}))

mock.module('@zeepkist/database/services', () => ({
	isModOutdated: async () => state.versionOutdated,
	getOrInsertUser: async (steamId: bigint, steamName?: string) => ({
		...(state.userBySteamId ?? { id: 1, steamId, steamName: steamName ?? 'Zeep' }),
		steamId,
		steamName: steamName ?? 'Zeep',
	}),
	getUser: async (steamId: string) =>
		steamId === '12345678901234567' ? state.userBySteamId : null,
	getUserByDiscordId: async (discordId: string) =>
		discordId === '76561198000000000' ? state.userByDiscordId : null,
	getAuthByUserAndRefreshToken: async (_idUser: number, token: string) =>
		token === 'existing-refresh' ? state.refreshAuth : null,
	deleteAuthByRefreshToken: async (token: string) => {
		state.deletedRefreshTokens.push(token)
	},
	insertAuth: async (input: Record<string, unknown>) => {
		state.insertAuthCalls.push(input)
		return input
	},
	getOrInsertLevel: async (hash: string) =>
		hash === state.level.hash && state.levelExists ? state.level : null,
	getLevel: async (hash: string) =>
		hash === state.level.hash && state.levelExists ? state.level : null,
	insertRecord: async (input: Record<string, unknown>) => ({ ...state.record, ...input }),
	insertRecordMedia: async (input: Record<string, unknown>) => ({
		...state.recordMedia,
		...input,
	}),
	upsertPersonalBest: async () => ({ id: 1 }),
	upsertWorldRecord: async () => ({ id: 1 }),
	upsertVote: async (idUser: number, idLevel: number, value: number) => ({
		idUser,
		idLevel,
		value,
	}),
	updateDiscordId: async (steamId: string, discordId: bigint | null) => {
		state.updatedDiscordIds.push({ steamId, discordId })
		return { id: 1, steamId: BigInt(steamId), discordId }
	},
}))

mock.module('@zeepkist/jobs/queue', () => ({
	enqueueCompatibleTask: async (task: string, options: Record<string, unknown>) => {
		state.jobCalls.push({ task, options })
	},
	isCompatibleTask: (task: string) =>
		[
			'updateLevelScore',
			'updateLevelScores',
			'updatePlayerScores',
			'updateUserPointsHistory',
		].includes(task),
}))

const { buildServer } = await import('./server')
const app = buildServer()

beforeEach(() => {
	resetState()
})

async function send(path: string, init?: RequestInit) {
	return app.handle(new Request(`http://localhost${path}`, init))
}

async function readBody(response: Response) {
	const text = await response.text()
	if (!text) {
		return null
	}

	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

test('auth/login returns V1-shaped token payload on success', async () => {
	const response = await send('/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			ModVersion: '1.0.0',
			SteamId: '12345678901234567',
			AuthenticationTicket: 'steam-ticket',
		}),
	})

	expect(response.status).toBe(200)
	expect(await readBody(response)).toEqual({
		AccessToken: 'gtr:12345678901234567:access:1',
		AccessTokenExpiry: 1900000001,
		RefreshToken: 'refresh:1',
		RefreshTokenExpiry: 1900000101,
	})
})

test('auth/login returns 400 when mod version is outdated', async () => {
	state.versionOutdated = true
	const response = await send('/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			ModVersion: '0.9.0',
			SteamId: '12345678901234567',
			AuthenticationTicket: 'steam-ticket',
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 9, message: 'Mod version is outdated' },
	})
})

test('auth/login returns 401 on Steam authentication failure', async () => {
	state.steamAuthSuccess = false
	const response = await send('/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			ModVersion: '1.0.0',
			SteamId: '12345678901234567',
			AuthenticationTicket: 'steam-ticket',
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 11, message: 'Steam authentication failed' },
	})
})

test('auth/login returns 401 on Steam ID mismatch', async () => {
	state.steamAuthSteamId = '11111111111111111'
	const response = await send('/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			ModVersion: '1.0.0',
			SteamId: '12345678901234567',
			AuthenticationTicket: 'steam-ticket',
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 10, message: 'Steam ID mismatch' },
	})
})

test('auth/refresh returns rotated tokens on success', async () => {
	const response = await send('/auth/refresh', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			ModVersion: '1.0.0',
			SteamId: '12345678901234567',
			LoginToken: 'login-token',
			RefreshToken: 'existing-refresh',
		}),
	})

	expect(response.status).toBe(200)
	expect(await readBody(response)).toEqual({
		AccessToken: 'gtr:12345678901234567:access:1',
		AccessTokenExpiry: 1900000001,
		RefreshToken: 'refresh:1',
		RefreshTokenExpiry: 1900000101,
	})
	expect(state.deletedRefreshTokens).toEqual(['existing-refresh'])
})

test('auth/refresh returns 401 for invalid refresh token', async () => {
	state.refreshAuth = null
	const response = await send('/auth/refresh', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			ModVersion: '1.0.0',
			SteamId: '12345678901234567',
			LoginToken: 'login-token',
			RefreshToken: 'existing-refresh',
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 15, message: 'Invalid or expired token' },
	})
})

test('auth/discord/redirect returns 302 to Discord', async () => {
	const response = await send('/auth/discord/redirect')

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toBe('https://discord.com/oauth2/authorize?mock=1')
})

test('auth/discord/callback returns 400 when code is missing', async () => {
	const response = await send('/auth/discord/callback')

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 14, message: 'Not authenticated' },
	})
})

test('auth/discord/callback returns 400 when Discord is not linked', async () => {
	state.userByDiscordId = null
	const response = await send('/auth/discord/callback?code=good')

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 24, message: 'Discord account not linked' },
	})
})

test('auth/discord/callback returns redirect and cookies on success', async () => {
	const response = await send('/auth/discord/callback?code=good')

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toBe('http://localhost:5173/auth/callback')
	expect(response.headers.get('set-cookie') ?? '').toContain('zeepcentral_access_token=')
	expect(await response.text()).toBe('')
})

test('auth/steam/redirect returns 302 to Steam OpenID', async () => {
	const response = await send('/auth/steam/redirect')

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toBe('https://steamcommunity.com/openid/login?mock=1')
})

test('auth/steam/callback returns 401 on invalid signature', async () => {
	state.steamSignatureValid = false
	const response = await send(
		'/auth/steam/callback?openid.identity=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F12345678901234567',
	)

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 15, message: 'Invalid or expired token' },
	})
})

test('auth/steam/callback returns redirect and cookies on success', async () => {
	const response = await send(
		'/auth/steam/callback?openid.identity=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F12345678901234567',
	)

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toBe('http://localhost:5173/auth/callback')
	expect(response.headers.get('set-cookie') ?? '').toContain('zeepcentral_refresh_token=')
})

test('auth/web/refresh returns 400 when cookies are missing', async () => {
	const response = await send('/auth/web/refresh', { method: 'POST' })

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 14, message: 'Not authenticated' },
	})
})

test('auth/web/refresh returns 404 when user is missing', async () => {
	state.userBySteamId = null
	const response = await send('/auth/web/refresh', {
		method: 'POST',
		headers: {
			cookie: 'zeepcentral_access_token=existing-access; zeepcentral_refresh_token=existing-refresh; zeepcentral_steam_id=12345678901234567',
		},
	})

	expect(response.status).toBe(404)
	expect(await readBody(response)).toEqual({
		error: { code: 16, message: 'User not found' },
	})
})

test('auth/web/refresh returns 200 and refreshed cookies on success', async () => {
	const response = await send('/auth/web/refresh', {
		method: 'POST',
		headers: {
			cookie: 'zeepcentral_access_token=existing-access; zeepcentral_refresh_token=existing-refresh; zeepcentral_steam_id=12345678901234567',
		},
	})

	expect(response.status).toBe(200)
	expect(await readBody(response)).toBeNull()
	expect(response.headers.get('set-cookie') ?? '').toContain('zeepcentral_access_token=')
})

test('record/submit returns 200 with empty body on success', async () => {
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'Z2hvc3Q=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
})

test('record/submit returns 401 when authenticated user is missing', async () => {
	state.userBySteamId = null
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'Z2hvc3Q=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 16, message: 'User not found' },
	})
})

test('vote/submit returns 200 with empty body on success', async () => {
	const response = await send('/vote/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Value: 2,
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
})

test('vote/submit returns 400 when level is missing', async () => {
	state.levelExists = false
	const response = await send('/vote/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: 'missing-level',
			Value: 2,
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 18, message: 'Level not found' },
	})
})

test('user/updateDiscordId returns 200 and links discord id', async () => {
	const response = await send('/user/updateDiscordId', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer steam-valid',
		},
		body: JSON.stringify({
			Id: '76561198000000000',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.updatedDiscordIds).toEqual([
		{ steamId: '12345678901234567', discordId: 76561198000000000n },
	])
})

test('user/updateDiscordId returns 200 and unlinks discord id when Id is -1', async () => {
	const response = await send('/user/updateDiscordId', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer steam-valid',
		},
		body: JSON.stringify({
			Id: '-1',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.updatedDiscordIds).toEqual([{ steamId: '12345678901234567', discordId: null }])
})

test('job/trigger returns 200 and enqueues a compatible task', async () => {
	const response = await send('/job/trigger', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer job-secret',
		},
		body: JSON.stringify({
			Task: 'updateLevelScore',
			Options: { idLevel: 1, idUser: 2 },
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.jobCalls).toEqual([
		{ task: 'updateLevelScore', options: { idLevel: 1, idUser: 2 } },
	])
})

test('job/trigger returns 400 for unsupported tasks', async () => {
	const response = await send('/job/trigger', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer job-secret',
		},
		body: JSON.stringify({
			Task: 'unknownTask',
			Options: {},
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 22, message: 'Invalid request' },
	})
})

test('job/trigger returns 401 for invalid job token', async () => {
	const response = await send('/job/trigger', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer wrong-secret',
		},
		body: JSON.stringify({
			Task: 'updateLevelScore',
			Options: {},
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 15, message: 'Invalid or expired token' },
	})
})
