import { beforeEach, expect, mock, test } from 'bun:test'

process.env.BACKEND_URL = 'http://localhost:3000'
process.env.FRONTEND_URL = 'http://localhost:4000'
process.env.TRIGGER_JOB_TOKEN = 'job-secret'

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
	metadataPresent: false,
	claimSucceeds: true,
	scanEnqueueFails: false,
	accessTokenCounter: 0,
	refreshTokenCounter: 0,
	insertAuthCalls: [] as Array<Record<string, unknown>>,
	getOrInsertUserCalls: [] as Array<{ steamId: bigint; steamName?: string }>,
	deletedRefreshTokens: [] as string[],
	jobCalls: [] as Array<{ task: string; options: Record<string, unknown> }>,
	jobEnqueueGate: null as Promise<void> | null,
	workshopScanCalls: [] as bigint[],
	workshopClaims: [] as bigint[],
	workshopReleases: [] as bigint[],
	levelAdventureUpdates: [] as boolean[],
	canonicalLevelRequests: [] as Array<{ hash: string; xxHash: string; adventure: boolean }>,
	canonicalInsertMissingLevel: false,
	updatedDiscordIds: [] as Array<{ steamId: string; discordId: bigint | null }>,
	discordLinkCodes: [] as Array<{ codeHash: string; idUser: number; expiresAt: string }>,
	mediaSchedules: [] as Array<{ idRecord: number; ghostData: string }>,
	recordStatistics: [] as Array<Record<string, unknown> | undefined>,
	favouriteAdds: [] as Array<{ idUser: number; idLevel: number }>,
	favouriteRemoves: [] as Array<{ idUser: number; idLevel: number }>,
	voteUpserts: [] as Array<{ idUser: number; idLevel: number; value: number }>,
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
		xxHash: '0123456789ABCDEF0123456789ABCDEF',
		adventure: false,
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
	state.metadataPresent = false
	state.claimSucceeds = true
	state.scanEnqueueFails = false
	state.accessTokenCounter = 0
	state.refreshTokenCounter = 0
	state.insertAuthCalls = []
	state.getOrInsertUserCalls = []
	state.deletedRefreshTokens = []
	state.jobCalls = []
	state.jobEnqueueGate = null
	state.workshopScanCalls = []
	state.workshopClaims = []
	state.workshopReleases = []
	state.levelAdventureUpdates = []
	state.canonicalLevelRequests = []
	state.canonicalInsertMissingLevel = false
	state.updatedDiscordIds = []
	state.discordLinkCodes = []
	state.mediaSchedules = []
	state.recordStatistics = []
	state.favouriteAdds = []
	state.favouriteRemoves = []
	state.voteUpserts = []
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
		xxHash: '0123456789ABCDEF0123456789ABCDEF',
		adventure: false,
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

const mockServerConfig = {
	nodeEnv: 'test',
	api: { host: '0.0.0.0', port: 3000, maxRequestBodySize: 32 * 1024 * 1024 },
	job: { triggerToken: 'job-secret' },
	jwt: {
		secret: 'x'.repeat(32),
		audience: 'zeepki.st',
		issuer: 'https://zeepki.st',
		accessTtlMs: 900_000,
		refreshTtlMs: 2_592_000_000,
	},
	backendUrl: 'http://localhost:3000',
	frontendUrl: 'http://localhost:4000',
	discord: {
		clientId: 'discord-client-id',
		clientSecret: 'discord-client-secret',
		redirectUri: 'http://localhost:3000/auth/discord/callback',
		botApiToken: 'discord-bot-api-token-for-contract-tests',
	},
	steam: {
		appId: 1_440_670,
		apiKey: 'steam-api-key',
	},
	otel: {
		serviceName: 'zeepcentraal-api',
		serviceVersion: undefined,
		collectorUrl: 'http://localhost:4317',
	},
	http: {
		corsAllowedOrigins: ['http://localhost:4000'],
		trustProxy: false,
		rateLimits: { auth: 10_000, record: 10_000, mutation: 10_000, job: 10_000 },
	},
}

mock.module('@zeepkist/core', () => ({
	COOKIES: {
		AccessToken: 'zeepcentral_access_token',
		RefreshToken: 'zeepcentral_refresh_token',
		SteamId: 'zeepcentral_steam_id',
		OAuthState: 'zeepcentral_oauth_state',
	},
	parseCookieHeader: (header = '') =>
		Object.fromEntries(
			header
				.split(';')
				.map((item: string) => item.trim().split('='))
				.filter(([key]: string[]) => key),
		),
	getCookie: (header: string | undefined, name: string) => {
		for (const item of (header ?? '').split(';')) {
			const [key, value] = item.trim().split('=')
			if (key === name) return value ?? null
		}
		return null
	},
	config: mockServerConfig,
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
	getDiscordRedirectUrl: (oauthState?: string) =>
		`https://discord.com/oauth2/authorize?mock=1${oauthState ? `&state=${oauthState}` : ''}`,
	getDiscordAccessToken: async () => state.discordAccessToken,
	getDiscordUser: async () => state.discordUser,
	getSteamRedirectUrl: (oauthState?: string) =>
		`https://steamcommunity.com/openid/login?mock=1${oauthState ? `&state=${oauthState}` : ''}`,
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
	DISCORD_FEED_KINDS: ['workshop', 'world_record', 'rank', 'totw', 'totm'],
	DISCORD_WATCH_KINDS: ['player', 'level', 'author', 'tournament'],
	addDiscordWatch: async () => null,
	advanceDiscordGuildFeedCursor: async () => null,
	advanceDiscordWorkerCursor: async () => null,
	consumeDiscordLinkCode: async () => ({ status: 'linked', idUser: 1 }),
	consumeDiscordOAuthLinkState: async () => ({ status: 'linked', idUser: 1 }),
	createDiscordLinkCode: async (input: {
		codeHash: string
		idUser: number
		expiresAt: string
	}) => {
		state.discordLinkCodes.push(input)
		return input
	},
	createDiscordOAuthLinkState: async () => null,
	getDiscordGuildState: async () => ({
		config: null,
		feeds: [],
		digest: null,
		tournamentMessages: [],
	}),
	getEnabledDiscordGuildFeeds: async () => [
		{
			guildId: 123n,
			kind: 'workshop',
			channelId: 456n,
			enabled: true,
			cursorEventId: 789n,
		},
	],
	getDiscordDelivery: async () => null,
	getDiscordWorkerCursor: async () => ({ key: 'watch-events', cursorEventId: 0n }),
	getMatchingDiscordWatches: async () => [],
	getDiscordUserState: async () => ({ linkedUser: null, preference: null, watches: [] }),
	removeDiscordWatch: async () => null,
	setDiscordDelivery: async () => null,
	setDiscordDigest: async () => null,
	setDiscordGuildFeed: async () => null,
	setDiscordGuildLinkedRole: async () => null,
	setDiscordTournamentMessage: async () => null,
	setDiscordUserPreference: async () => null,
	updateDiscordWatchDelivery: async () => null,
	unlinkDiscordByDiscordId: async () => null,
	unlinkDiscordBySteamId: async () => null,
	isModOutdated: async () => state.versionOutdated,
	getOrInsertUser: async (steamId: bigint, steamName?: string) => {
		state.getOrInsertUserCalls.push({ steamId, steamName })
		return {
			...(state.userBySteamId ?? { id: 1, steamId, steamName: steamName ?? 'Zeep' }),
			steamId,
			steamName: steamName ?? 'Zeep',
		}
	},
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
	rotateAuth: async (_idUser: number, token: string, input: Record<string, unknown>) => {
		if (token !== 'existing-refresh' || !state.refreshAuth) {
			return null
		}
		state.deletedRefreshTokens.push(token)
		state.insertAuthCalls.push(input)
		return input
	},
	getOrInsertLevelWithAdventure: async (hash: string, adventure: boolean) => {
		state.levelAdventureUpdates.push(adventure)
		return hash === state.level.hash && state.levelExists ? { ...state.level, adventure } : null
	},
	getOrInsertLevelWithCanonicalHash: async ({
		hash,
		xxHash,
		adventure,
	}: {
		hash: string
		xxHash: string
		adventure: boolean
	}) => {
		state.canonicalLevelRequests.push({ hash, xxHash, adventure })
		state.levelAdventureUpdates.push(adventure)
		return xxHash === state.level.xxHash &&
			(state.levelExists || state.canonicalInsertMissingLevel)
			? { ...state.level, hash, adventure: state.level.adventure }
			: null
	},
	hasLevelMetadata: async () => state.metadataPresent,
	claimLevelRequest: async ({ workshopId }: { workshopId: bigint }) => {
		state.workshopClaims.push(workshopId)
		return state.claimSucceeds
	},
	claimMissingLevelMetadataRequest: async ({ workshopId }: { workshopId: bigint }) => {
		if (!state.metadataPresent) state.workshopClaims.push(workshopId)
		return !state.metadataPresent && state.claimSucceeds
	},
	releaseLevelRequest: async (workshopId: bigint) => {
		state.workshopReleases.push(workshopId)
	},
	getRecordMediaForStatisticBackfill: async () => [],
	upsertRecordStatistic: async () => {},
	getLevel: async (hash: string) =>
		hash === state.level.hash && state.levelExists ? state.level : null,
	getLevelByXxHash: async (xxHash: string) =>
		xxHash === state.level.xxHash && state.levelExists ? state.level : null,
	addFavourite: async (idUser: number, idLevel: number) => {
		state.favouriteAdds.push({ idUser, idLevel })
	},
	removeFavourite: async (idUser: number, idLevel: number) => {
		state.favouriteRemoves.push({ idUser, idLevel })
	},
	submitRecord: async (input: Record<string, unknown>, statistic?: Record<string, unknown>) => {
		state.recordStatistics.push(statistic)
		return {
			record: { ...state.record, ...input },
			personalBestChanged: true,
			tournamentResultChanged: false,
		}
	},
	scheduleRecordMediaUpload: (idRecord: number, ghostData: string) => {
		state.mediaSchedules.push({ idRecord, ghostData })
	},
	upsertVote: async (idUser: number, idLevel: number, value: number) => {
		state.voteUpserts.push({ idUser, idLevel, value })
		return {
			idUser,
			idLevel,
			value,
		}
	},
	updateDiscordId: async (steamId: string, discordId: bigint | null) => {
		state.updatedDiscordIds.push({ steamId, discordId })
		return { id: 1, steamId: BigInt(steamId), discordId }
	},
}))

mock.module('@zeepkist/jobs/queue', () => ({
	enqueueCompatibleTask: async (task: string, options: Record<string, unknown>) => {
		if (state.jobEnqueueGate) await state.jobEnqueueGate
		state.jobCalls.push({ task, options })
	},
	enqueueWorkshopScan: async (workshopId: bigint) => {
		if (state.scanEnqueueFails) {
			throw new Error('queue failed')
		}
		state.workshopScanCalls.push(workshopId)
	},
	isCompatibleTask: (task: string) =>
		[
			'updateLevelScore',
			'updateLevelScores',
			'updatePlayerScores',
			'updateUserPointsHistory',
		].includes(task),
	isValidTaskPayload: (task: string, options: Record<string, unknown>) =>
		task !== 'updateLevelScore' || typeof options.idLevel === 'number',
}))

mock.module('@zeepkist/core/config/server', () => ({ serverConfig: mockServerConfig }))

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

async function oauthState(path: '/auth/discord/redirect' | '/auth/steam/redirect') {
	const response = await send(path)
	const location = new URL(response.headers.get('location') ?? '')
	const stateValue = location.searchParams.get('state') ?? ''
	const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
	return { stateValue, cookie }
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
	expect(state.getOrInsertUserCalls).toEqual([
		{ steamId: 12345678901234567n, steamName: undefined },
	])
})

test('CORS allows configured website origin and rejects arbitrary origins', async () => {
	const allowed = await send('/healthz', {
		headers: { origin: 'http://localhost:4000' },
	})
	expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:4000')

	const rejected = await send('/healthz', {
		headers: { origin: 'https://attacker.example' },
	})
	expect(rejected.headers.get('access-control-allow-origin')).toBeNull()
})

test('OpenAPI document groups every public operation by category', async () => {
	type OpenApiOperation = {
		operationId?: string
		security?: Array<Record<string, string[]>>
		summary?: string
		tags?: string[]
	}
	type OpenApiDocument = {
		components?: { securitySchemes?: Record<string, unknown> }
		paths: Record<string, Record<string, OpenApiOperation>>
		tags?: Array<{ description?: string; name: string }>
	}

	const response = await send('/openapi/json')
	expect(response.status).toBe(200)
	const document = (await response.json()) as OpenApiDocument
	const expectedOperations = {
		'POST /auth/login': ['loginGtr', 'auth'],
		'POST /auth/refresh': ['refreshGtrSession', 'auth'],
		'GET /auth/discord/redirect': ['startDiscordLogin', 'auth'],
		'GET /auth/discord/callback': ['completeDiscordLogin', 'auth'],
		'GET /auth/steam/redirect': ['startSteamLogin', 'auth'],
		'GET /auth/steam/callback': ['completeSteamLogin', 'auth'],
		'POST /auth/web/refresh': ['refreshWebSession', 'auth'],
		'POST /user/updateSteamName': ['updateSteamName', 'user'],
		'POST /user/updateDiscordId': ['updateDiscordId', 'user'],
		'POST /level/request': ['requestLevel', 'level'],
		'POST /favourite/add': ['addFavourite', 'favourite'],
		'POST /favourite/remove': ['removeFavourite', 'favourite'],
		'POST /record/submit': ['submitRecord', 'record'],
		'POST /vote/submit': ['submitVote', 'vote'],
		'POST /job/trigger': ['triggerJob', 'job'],
		'GET /lobby': ['getLobbySnapshot', 'lobby'],
		'GET /lobby/events': ['streamLobbySnapshots', 'lobby'],
		'GET /healthz': ['getHealth', 'system'],
	} as const

	for (const [route, [operationId, tag]] of Object.entries(expectedOperations)) {
		const [method, path] = route.split(' ') as [string, string]
		const operation = document.paths[path]?.[method.toLowerCase()]
		expect(operation, `${route} should be present`).toBeDefined()
		expect(operation?.operationId).toBe(operationId)
		expect(operation?.summary).toBeTruthy()
		expect(operation?.tags).toEqual([tag])
	}

	const documentedTags = new Map(document.tags?.map((tag) => [tag.name, tag.description]))
	for (const tag of [
		'auth',
		'discord-bot',
		'user',
		'level',
		'lobby',
		'favourite',
		'record',
		'vote',
		'job',
		'system',
	]) {
		expect(documentedTags.get(tag)).toBeTruthy()
	}

	expect(Object.keys(document.components?.securitySchemes ?? {}).sort()).toEqual([
		'accessToken',
		'discordBotBearerAuth',
		'gtrBearerAuth',
		'jobBearerAuth',
		'webRefreshSession',
		'webSession',
	])
	expect(document.paths['/auth/web/refresh']?.post?.security).toEqual([{ webRefreshSession: [] }])
	expect(document.paths['/favourite/add']?.post?.security).toEqual([
		{ accessToken: [] },
		{ webSession: [] },
	])
	expect(document.paths['/favourite/remove']?.post?.security).toEqual([
		{ accessToken: [] },
		{ webSession: [] },
	])
	expect(document.paths['/favicon.ico']).toBeUndefined()
})

test('OpenAPI documents exact favourite request and response schemas', async () => {
	const response = await send('/openapi/json')
	const document = (await response.json()) as {
		paths: Record<
			string,
			Record<
				string,
				{
					requestBody?: { content?: Record<string, { schema?: unknown }> }
					responses?: Record<string, unknown>
				}
			>
		>
	}

	for (const path of ['/favourite/add', '/favourite/remove']) {
		const operation = document.paths[path]?.post
		expect(operation?.requestBody?.content?.['application/json']?.schema).toMatchObject({
			type: 'object',
			additionalProperties: { not: {} },
			required: ['hash'],
			properties: {
				hash: { type: 'string', pattern: '^[0-9A-F]{32}$' },
			},
		})
		expect(Object.keys(operation?.responses ?? {}).toSorted()).toEqual(['200', '400', '401'])
	}
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
	expect(response.headers.get('location')).toContain(
		'https://discord.com/oauth2/authorize?mock=1',
	)
	expect(response.headers.get('location')).toContain('&state=')
})

test('auth/discord/callback returns 400 when code is missing', async () => {
	const response = await send('/auth/discord/callback')

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 14, message: 'Not authenticated' },
	})
})

test('auth/discord/callback rejects mismatched OAuth state', async () => {
	const { cookie } = await oauthState('/auth/discord/redirect')
	const response = await send('/auth/discord/callback?code=good&state=wrong', {
		headers: { cookie },
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 14, message: 'Not authenticated' },
	})
})

test('auth/discord/callback returns 400 when Discord is not linked', async () => {
	state.userByDiscordId = null
	const { stateValue, cookie } = await oauthState('/auth/discord/redirect')
	const response = await send(`/auth/discord/callback?code=good&state=${stateValue}`, {
		headers: { cookie },
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 24, message: 'Discord account not linked' },
	})
})

test('auth/discord/callback returns redirect and cookies on success', async () => {
	const { stateValue, cookie } = await oauthState('/auth/discord/redirect')
	const response = await send(`/auth/discord/callback?code=good&state=${stateValue}`, {
		headers: { cookie },
	})

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toBe('http://localhost:4000/?auth=callback')
	const cookies = response.headers.getSetCookie()
	const issuedCookies = cookies.filter((cookie) => !cookie.startsWith('zeepcentral_oauth_state='))
	expect(issuedCookies).toHaveLength(3)
	expect(issuedCookies.every((cookie) => !cookie.includes('Domain='))).toBe(true)
	expect(
		issuedCookies.find((cookie) => cookie.startsWith('zeepcentral_access_token=')),
	).toContain('HttpOnly')
	expect(
		issuedCookies.find((cookie) => cookie.startsWith('zeepcentral_refresh_token=')),
	).toContain('HttpOnly')
	expect(
		issuedCookies.find((cookie) => cookie.startsWith('zeepcentral_steam_id=')),
	).not.toContain('HttpOnly')
	expect(cookies.find((cookie) => cookie.startsWith('zeepcentral_oauth_state='))).toContain(
		'Max-Age=0',
	)
	expect(state.insertAuthCalls).toEqual([
		expect.objectContaining({
			idUser: 1,
			provider: 'discord',
			accessToken: 'discord:12345678901234567:access:1',
			refreshToken: 'refresh:1',
		}),
	])
	expect(await response.text()).toBe('')
})

test('auth/steam/redirect returns 302 to Steam OpenID', async () => {
	const response = await send('/auth/steam/redirect')

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toContain(
		'https://steamcommunity.com/openid/login?mock=1',
	)
	expect(response.headers.get('location')).toContain('&state=')
})

test('auth/steam/callback returns 401 on invalid signature', async () => {
	state.steamSignatureValid = false
	const { stateValue, cookie } = await oauthState('/auth/steam/redirect')
	const response = await send(
		`/auth/steam/callback?state=${stateValue}&openid.identity=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F12345678901234567`,
		{ headers: { cookie } },
	)

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 15, message: 'Invalid or expired token' },
	})
})

test('auth/steam/callback returns redirect and cookies on success', async () => {
	const { stateValue, cookie } = await oauthState('/auth/steam/redirect')
	const response = await send(
		`/auth/steam/callback?state=${stateValue}&openid.identity=https%3A%2F%2Fsteamcommunity.com%2Fopenid%2Fid%2F12345678901234567`,
		{ headers: { cookie } },
	)

	expect(response.status).toBe(302)
	expect(response.headers.get('location')).toBe('http://localhost:4000/?auth=callback')
	const cookies = response.headers.getSetCookie()
	const issuedCookies = cookies.filter((cookie) => !cookie.startsWith('zeepcentral_oauth_state='))
	expect(issuedCookies).toHaveLength(3)
	expect(issuedCookies.every((cookie) => !cookie.includes('Domain='))).toBe(true)
	expect(
		issuedCookies.find((cookie) => cookie.startsWith('zeepcentral_access_token=')),
	).toContain('HttpOnly')
	expect(
		issuedCookies.find((cookie) => cookie.startsWith('zeepcentral_refresh_token=')),
	).toContain('HttpOnly')
	expect(
		issuedCookies.find((cookie) => cookie.startsWith('zeepcentral_steam_id=')),
	).not.toContain('HttpOnly')
	expect(cookies.find((cookie) => cookie.startsWith('zeepcentral_oauth_state='))).toContain(
		'Max-Age=0',
	)
	expect(state.getOrInsertUserCalls).toEqual([
		{ steamId: 12345678901234567n, steamName: undefined },
	])
	expect(state.insertAuthCalls).toEqual([
		expect.objectContaining({
			idUser: 1,
			provider: 'steam',
			accessToken: 'steam:12345678901234567:access:1',
			refreshToken: 'refresh:1',
		}),
	])
})

test('auth/web/refresh returns 400 when cookies are missing', async () => {
	const response = await send('/auth/web/refresh', { method: 'POST' })

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 14, message: 'Not authenticated' },
	})
})

test('auth/web/refresh requires the refresh token and Steam ID cookie pair', async () => {
	for (const cookie of [
		'zeepcentral_refresh_token=existing-refresh',
		'zeepcentral_steam_id=12345678901234567',
	]) {
		const response = await send('/auth/web/refresh', {
			method: 'POST',
			headers: { cookie },
		})

		expect(response.status).toBe(400)
		expect(await readBody(response)).toEqual({
			error: { code: 14, message: 'Not authenticated' },
		})
	}
})

test('auth/web/refresh returns 404 when user is missing', async () => {
	state.userBySteamId = null
	const response = await send('/auth/web/refresh', {
		method: 'POST',
		headers: {
			cookie: 'zeepcentral_refresh_token=existing-refresh; zeepcentral_steam_id=12345678901234567',
		},
	})

	expect(response.status).toBe(404)
	expect(await readBody(response)).toEqual({
		error: { code: 16, message: 'User not found' },
	})
})

test('auth/web/refresh recreates a missing access cookie on success', async () => {
	const response = await send('/auth/web/refresh', {
		method: 'POST',
		headers: {
			cookie: 'zeepcentral_refresh_token=existing-refresh; zeepcentral_steam_id=12345678901234567',
		},
	})

	expect(response.status).toBe(200)
	expect(await readBody(response)).toBeNull()
	const setCookies = response.headers.get('set-cookie') ?? ''
	expect(setCookies).toContain('zeepcentral_access_token=')
	expect(setCookies).toContain('zeepcentral_refresh_token=')
	expect(setCookies).toContain('zeepcentral_steam_id=')
	expect(state.deletedRefreshTokens).toContain('existing-refresh')
})

test('auth/web/refresh rejects an invalid refresh token when the access cookie is missing', async () => {
	state.refreshAuth = null
	const response = await send('/auth/web/refresh', {
		method: 'POST',
		headers: {
			cookie: 'zeepcentral_refresh_token=invalid-refresh; zeepcentral_steam_id=12345678901234567',
		},
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 15, message: 'Invalid or expired token' },
	})
})

test('level/request queues workshop scan when canonical hash is unknown', async () => {
	state.levelExists = false
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			WorkshopId: '3749321871',
			Hash: state.level.xxHash,
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.workshopClaims).toEqual([3749321871n])
	expect(state.workshopScanCalls).toEqual([3749321871n])
})

test('level/request does not enqueue when canonical hash already exists', async () => {
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			WorkshopId: '3749321871',
			Hash: state.level.xxHash,
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.workshopClaims).toEqual([])
	expect(state.workshopScanCalls).toEqual([])
})

test('level/request does not enqueue when concurrent claim already exists', async () => {
	state.levelExists = false
	state.claimSucceeds = false
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			WorkshopId: '3749321871',
			Hash: state.level.xxHash,
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.workshopClaims).toEqual([3749321871n])
	expect(state.workshopScanCalls).toEqual([])
})

test('level/request releases workshop claim when enqueue fails', async () => {
	state.levelExists = false
	state.scanEnqueueFails = true
	const originalConsoleError = console.error
	const loggedErrors: unknown[][] = []
	console.error = (...args: unknown[]) => {
		loggedErrors.push(args)
	}
	try {
		const response = await send('/level/request', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer gtr-valid',
			},
			body: JSON.stringify({
				WorkshopId: '3749321871',
				Hash: state.level.xxHash,
			}),
		})

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('')
		expect(state.workshopReleases).toEqual([3749321871n])
		expect(loggedErrors).toHaveLength(1)
	} finally {
		console.error = originalConsoleError
	}
})

test('level/request rejects invalid workshop ID with V1 error shape', async () => {
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			WorkshopId: 'not-a-number',
			Hash: state.level.xxHash,
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 22, message: 'Invalid request' },
	})
})

test('level/request rejects invalid canonical hash with V1 error shape', async () => {
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			WorkshopId: '3749321871',
			Hash: state.level.xxHash.toLowerCase(),
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 22, message: 'Invalid request' },
	})
})

test('level/request returns 400 when token is missing', async () => {
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			WorkshopId: '3749321871',
			Hash: state.level.xxHash,
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toBe('Not authenticated')
})

test('level/request returns 401 for non-GTR token', async () => {
	const response = await send('/level/request', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer steam-valid',
		},
		body: JSON.stringify({
			WorkshopId: '3749321871',
			Hash: state.level.xxHash,
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toBe('Invalid or expired token')
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
			Hash: state.level.xxHash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.mediaSchedules).toEqual([{ idRecord: 20, ghostData: 'AQAAAAAAAAA=' }])
	expect(state.recordStatistics).toEqual([
		expect.objectContaining({
			ghostVersion: 1,
			hasInputData: false,
			hasAirData: false,
			hasWheelData: false,
			hasSlipData: false,
			hasStateData: false,
			hasSurfaceData: false,
			hasVelocityData: false,
			hasRagdollData: false,
			timeAnyDriverInput: null,
			driverInputTransitionCount: null,
		}),
	])
	expect(state.levelAdventureUpdates).toEqual([true])
	expect(state.canonicalLevelRequests).toEqual([
		{ hash: state.level.hash, xxHash: state.level.xxHash, adventure: true },
	])
	expect(state.workshopScanCalls).toEqual([])
	await Bun.sleep(0)
	expect(state.jobCalls).toEqual([
		{ task: 'updateLevelScore', options: { idLevel: 10, idUser: 1 } },
	])
})

test('record/submit does not await level-score enqueue', async () => {
	let releaseEnqueue = () => {}
	state.jobEnqueueGate = new Promise<void>((resolve) => {
		releaseEnqueue = resolve
	})
	const response = await Promise.race([
		send('/record/submit', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer gtr-valid',
			},
			body: JSON.stringify({
				Level: state.level.hash,
				Hash: state.level.xxHash,
				Time: 12.345678,
				Splits: [1.2, 5.6],
				Speeds: [100, 200],
				GhostData: 'AQAAAAAAAAA=',
				GameVersion: '1.0.0',
				ModVersion: '1.0.0',
			}),
		}),
		Bun.sleep(100).then(() => null),
	])

	expect(response).not.toBeNull()
	expect(response?.status).toBe(200)
	expect(state.jobCalls).toEqual([])
	releaseEnqueue()
	await Bun.sleep(0)
	expect(state.jobCalls).toEqual([
		{ task: 'updateLevelScore', options: { idLevel: 10, idUser: 1 } },
	])
})

test('record/submit rejects missing canonical hash from old clients', async () => {
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
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 19, message: 'Missing required parameters' },
	})
	expect(state.mediaSchedules).toEqual([])
	expect(state.canonicalLevelRequests).toEqual([])
})

test('record/submit resolves by canonical hash without trusting legacy hash', async () => {
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: 'EDITED_LEGACY_HASH',
			Hash: state.level.xxHash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.mediaSchedules).toEqual([{ idRecord: 20, ghostData: 'AQAAAAAAAAA=' }])
	expect(state.canonicalLevelRequests).toEqual([
		{ hash: 'EDITED_LEGACY_HASH', xxHash: state.level.xxHash, adventure: true },
	])
})

test('record/submit inserts unknown level through canonical hash path', async () => {
	state.levelExists = false
	state.canonicalInsertMissingLevel = true
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: 'NEW_LEGACY_HASH',
			Hash: state.level.xxHash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.1.1',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.canonicalLevelRequests).toEqual([
		{ hash: 'NEW_LEGACY_HASH', xxHash: state.level.xxHash, adventure: true },
	])
})

test('record/submit queues missing workshop metadata with BigInt ID', async () => {
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Hash: state.level.xxHash,
			WorkshopId: '3749321871',
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.levelAdventureUpdates).toEqual([])
	expect(state.workshopClaims).toEqual([3749321871n])
	expect(state.workshopScanCalls).toEqual([3749321871n])
})

test('record/submit keeps durable workshop claim when asynchronous enqueue fails', async () => {
	state.scanEnqueueFails = true
	const originalConsoleError = console.error
	const loggedErrors: unknown[][] = []
	console.error = (...args: unknown[]) => {
		loggedErrors.push(args)
	}
	try {
		const response = await send('/record/submit', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer gtr-valid',
			},
			body: JSON.stringify({
				Level: state.level.hash,
				Hash: state.level.xxHash,
				WorkshopId: '3749321871',
				Time: 12.345678,
				Splits: [1.2, 5.6],
				Speeds: [100, 200],
				GhostData: 'AQAAAAAAAAA=',
				GameVersion: '1.0.0',
				ModVersion: '1.0.0',
			}),
		})

		expect(response.status).toBe(200)
		await Bun.sleep(0)
		expect(state.workshopClaims).toEqual([3749321871n])
		expect(state.workshopReleases).toEqual([])
		expect(loggedErrors).toHaveLength(1)
	} finally {
		console.error = originalConsoleError
	}
})

test('record/submit does not enqueue when concurrent claim already exists', async () => {
	state.claimSucceeds = false
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Hash: state.level.xxHash,
			WorkshopId: '3749321871',
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(200)
	expect(state.workshopClaims).toEqual([3749321871n])
	expect(state.workshopScanCalls).toEqual([])
})

test('record/submit rejects invalid workshop ID with V1 error shape', async () => {
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Hash: state.level.xxHash,
			WorkshopId: 'not-a-number',
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 19, message: 'Missing required parameters' },
	})
})

test('record/submit rejects missing canonical hash with V1 error shape', async () => {
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
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.1',
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 19, message: 'Missing required parameters' },
	})
})

test('record/submit rejects invalid canonical hash with V1 error shape', async () => {
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Hash: state.level.xxHash.toLowerCase(),
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.1.1',
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 19, message: 'Missing required parameters' },
	})
	expect(state.canonicalLevelRequests).toEqual([])
})

test('record/submit rejects malformed ghost data without changing wire error shape', async () => {
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Hash: state.level.xxHash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'not-base64',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 19, message: 'Missing required parameters' },
	})
})

test('record/submit rejects banned users', async () => {
	if (state.userBySteamId) state.userBySteamId.banned = true
	const response = await send('/record/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Level: state.level.hash,
			Hash: state.level.xxHash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 16, message: 'User not found' },
	})
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
			Hash: state.level.xxHash,
			Time: 12.345678,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: '1.0.0',
			ModVersion: '1.0.0',
		}),
	})

	expect(response.status).toBe(401)
	expect(await readBody(response)).toEqual({
		error: { code: 16, message: 'User not found' },
	})
})

test('favourite/add is idempotent through GTR bearer authentication', async () => {
	for (let attempt = 0; attempt < 2; attempt++) {
		const response = await send('/favourite/add', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer gtr-valid',
			},
			body: JSON.stringify({ hash: state.level.xxHash }),
		})

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('')
	}

	expect(state.favouriteAdds).toEqual([
		{ idUser: 1, idLevel: state.level.id },
		{ idUser: 1, idLevel: state.level.id },
	])
})

test('favourite/add accepts web session cookie authentication', async () => {
	const response = await send('/favourite/add', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			cookie: 'zeepcentral_access_token=steam-valid',
		},
		body: JSON.stringify({ hash: state.level.xxHash }),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.favouriteAdds).toEqual([{ idUser: 1, idLevel: state.level.id }])
})

test('favourite/remove is idempotent through web bearer authentication', async () => {
	for (let attempt = 0; attempt < 2; attempt++) {
		const response = await send('/favourite/remove', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer steam-valid',
			},
			body: JSON.stringify({ hash: state.level.xxHash }),
		})

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('')
	}

	expect(state.favouriteRemoves).toEqual([
		{ idUser: 1, idLevel: state.level.id },
		{ idUser: 1, idLevel: state.level.id },
	])
})

test('favourite/add returns level-not-found for an unknown canonical hash', async () => {
	state.levelExists = false
	const response = await send('/favourite/add', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({ hash: state.level.xxHash }),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 18, message: 'Level not found' },
	})
	expect(state.favouriteAdds).toEqual([])
})

test('favourite/remove succeeds without mutation for an unknown canonical hash', async () => {
	state.levelExists = false
	const response = await send('/favourite/remove', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({ hash: state.level.xxHash }),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.favouriteRemoves).toEqual([])
})

for (const [name, body] of [
	['missing hash', {}],
	['lowercase hash', { hash: '0123456789abcdef0123456789abcdef' }],
	['malformed hash', { hash: 'NOT-A-HASH' }],
	['additional property', { hash: '0123456789ABCDEF0123456789ABCDEF', extra: true }],
] as const) {
	test(`favourite routes reject ${name} through JSON schema`, async () => {
		for (const path of ['/favourite/add', '/favourite/remove']) {
			const response = await send(path, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: 'Bearer gtr-valid',
				},
				body: JSON.stringify(body),
			})

			expect(response.status).toBe(422)
		}
		expect(state.favouriteAdds).toEqual([])
		expect(state.favouriteRemoves).toEqual([])
	})
}

test('favourite routes require a valid access token', async () => {
	const missing = await send('/favourite/add', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ hash: state.level.xxHash }),
	})
	expect(missing.status).toBe(400)
	expect(await readBody(missing)).toBe('Not authenticated')

	const invalid = await send('/favourite/remove', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer invalid',
		},
		body: JSON.stringify({ hash: state.level.xxHash }),
	})
	expect(invalid.status).toBe(401)
	expect(await readBody(invalid)).toBe('Invalid or expired token')
	expect(state.favouriteAdds).toEqual([])
	expect(state.favouriteRemoves).toEqual([])
})

for (const stateName of ['missing', 'banned'] as const) {
	test(`favourite routes reject ${stateName} authenticated users`, async () => {
		if (stateName === 'missing') {
			state.userBySteamId = null
		} else if (state.userBySteamId) {
			state.userBySteamId.banned = true
		}

		for (const path of ['/favourite/add', '/favourite/remove']) {
			const response = await send(path, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: 'Bearer gtr-valid',
				},
				body: JSON.stringify({ hash: state.level.xxHash }),
			})

			expect(response.status).toBe(401)
			expect(await readBody(response)).toEqual({
				error: { code: 16, message: 'User not found' },
			})
		}
		expect(state.favouriteAdds).toEqual([])
		expect(state.favouriteRemoves).toEqual([])
	})
}

test('vote/submit returns 200 with empty body on success', async () => {
	const response = await send('/vote/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Hash: state.level.xxHash,
			Value: 2,
		}),
	})

	expect(response.status).toBe(200)
	expect(await response.text()).toBe('')
	expect(state.voteUpserts).toEqual([{ idUser: 1, idLevel: state.level.id, value: 2 }])
})

test('vote/submit returns 400 when canonical hash level is missing', async () => {
	state.levelExists = false
	const response = await send('/vote/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Hash: state.level.xxHash,
			Value: 2,
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 18, message: 'Level not found' },
	})
})

test('vote/submit rejects missing canonical hash', async () => {
	const response = await send('/vote/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Value: 2,
		}),
	})

	expect(response.status).toBe(422)
})

test('vote/submit returns 400 when canonical hash is invalid', async () => {
	const response = await send('/vote/submit', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer gtr-valid',
		},
		body: JSON.stringify({
			Hash: state.level.xxHash.toLowerCase(),
			Value: 2,
		}),
	})

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: { code: 17, message: 'Missing required parameters' },
	})
})

test('vote/submit rejects legacy Level-only body', async () => {
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

	expect(response.status).toBe(422)
	expect(state.voteUpserts).toEqual([])
})

test('user/updateDiscordId rejects unverified positive Discord IDs', async () => {
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

	expect(response.status).toBe(400)
	expect(await readBody(response)).toEqual({
		error: {
			code: 'discord_ownership_required',
			message: 'Positive Discord IDs require OAuth or one-time code verification.',
		},
	})
	expect(state.updatedDiscordIds).toEqual([])
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
	expect(state.updatedDiscordIds).toEqual([{ steamId: '12345678901234567', discordId: -1n }])
})

test('user/discord/link-code creates an expiring one-time code for authenticated user', async () => {
	const response = await send('/user/discord/link-code', {
		method: 'POST',
		headers: { authorization: 'Bearer steam-valid' },
	})

	expect(response.status).toBe(200)
	const body = (await readBody(response)) as { code: string; expiresAt: string }
	expect(body.code).toMatch(/^[0-9]{8}$/)
	expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())
	expect(state.discordLinkCodes).toHaveLength(1)
	expect(state.discordLinkCodes[0]?.codeHash).not.toContain(body.code)
})

test('discord-bot routes require dedicated bearer token', async () => {
	const denied = await send('/discord-bot/guilds/123')
	expect(denied.status).toBe(401)

	const allowed = await send('/discord-bot/guilds/123', {
		headers: { authorization: 'Bearer discord-bot-api-token-for-contract-tests' },
	})
	expect(allowed.status).toBe(200)
	expect(await readBody(allowed)).toEqual({
		config: null,
		feeds: [],
		digest: null,
		tournamentMessages: [],
	})

	const feeds = await send('/discord-bot/guild-feeds/enabled', {
		headers: { authorization: 'Bearer discord-bot-api-token-for-contract-tests' },
	})
	expect(feeds.status).toBe(200)
	expect(await readBody(feeds)).toEqual([
		{
			guildId: '123',
			kind: 'workshop',
			channelId: '456',
			enabled: true,
			cursorEventId: '789',
		},
	])
})

test('discord-bot watch matching accepts up to 50 target IDs per group', async () => {
	const sendMatches = (count: number) =>
		send('/discord-bot/watches/matches', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer discord-bot-api-token-for-contract-tests',
			},
			body: JSON.stringify({
				targets: [
					{
						kind: 'player',
						targetIds: Array.from({ length: count }, (_, index) => String(index + 1)),
					},
				],
			}),
		})

	const accepted = await sendMatches(50)
	expect(accepted.status).toBe(200)
	expect(await readBody(accepted)).toEqual([])

	const rejected = await sendMatches(51)
	expect(rejected.status).toBe(422)
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

test('job/trigger returns 400 for invalid compatible-task payload', async () => {
	const response = await send('/job/trigger', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer job-secret',
		},
		body: JSON.stringify({
			Task: 'updateLevelScore',
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
