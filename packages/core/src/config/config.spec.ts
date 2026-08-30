import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { parseDatabaseConfig } from './database'
import { parseImportZslConfig } from './importZsl'
import { parseJobsConfig } from './jobs'
import { parseLobbyHostConfig } from './lobbyHost'
import { parseMigrateConfig } from './migrate'
import { parsePostgraphileConfig } from './postgraphile'
import { parseServerConfig } from './server'

test('server config requires server-only secrets', () => {
	expect(() => parseServerConfig({})).toThrow()
})

test('server config lowers default request body limit', () => {
	const config = parseServerConfig({
		NODE_ENV: 'test',
	})

	expect(config.api.maxRequestBodySize).toBe(32 * 1024 * 1024)
})

test('server config accepts custom request body limit', () => {
	const config = parseServerConfig({
		NODE_ENV: 'test',
		SERVER_MAX_REQUEST_BODY_SIZE: '16777216',
		STEAM_APP_ID: '1',
	})

	expect(config.api.maxRequestBodySize).toBe(16 * 1024 * 1024)
	expect(config.steam.appId).toBe(1)
})

test('server config keeps lobby feed disabled by default', () => {
	const config = parseServerConfig({ NODE_ENV: 'test' })

	expect(config.lobby).toEqual({
		enabled: false,
		host: undefined,
		port: undefined,
		build: undefined,
		refreshTokenFile: '',
		broker: {
			enabled: false,
			host: '0.0.0.0',
			port: 3001,
			token: undefined,
			room: {
				name: 'ZeepCentraal | Track of the Week',
				isPublic: true,
				maxPlayers: 64,
			},
		},
	})
})

test('server config requires lobby endpoint and build when feed is enabled', () => {
	expect(() => parseServerConfig({ NODE_ENV: 'test', ZEEPKIST_LOBBY_ENABLED: 'true' })).toThrow(
		'ZEEPKIST_LOBBY_HOST is required',
	)
	expect(() =>
		parseServerConfig({
			NODE_ENV: 'test',
			ZEEPKIST_LOBBY_ENABLED: 'true',
			ZEEPKIST_LOBBY_HOST: '12.34.56.789',
		}),
	).toThrow('ZEEPKIST_LOBBY_BUILD is required')
})

test('server config accepts enabled lobby feed', () => {
	const config = parseServerConfig({
		NODE_ENV: 'test',
		ZEEPKIST_LOBBY_ENABLED: 'true',
		ZEEPKIST_LOBBY_HOST: '12.34.56.789',
		ZEEPKIST_LOBBY_PORT: '12345',
		ZEEPKIST_LOBBY_BUILD: '1234',
		ZEEPKIST_STEAM_REFRESH_TOKEN_FILE: '/tmp/steam-token',
	})

	expect(config.lobby).toEqual({
		enabled: true,
		host: '12.34.56.789',
		port: 12345,
		build: 1234,
		refreshTokenFile: '/tmp/steam-token',
		broker: {
			enabled: false,
			host: '0.0.0.0',
			port: 3001,
			token: undefined,
			room: {
				name: 'ZeepCentraal | Track of the Week',
				isPublic: true,
				maxPlayers: 64,
			},
		},
	})
})

test('server config requires lobby feed and token when room broker is enabled', () => {
	expect(() =>
		parseServerConfig({
			NODE_ENV: 'test',
			ZEEPKIST_ROOM_BROKER_ENABLED: 'true',
		}),
	).toThrow('ZEEPKIST_LOBBY_ENABLED is required')
	expect(() =>
		parseServerConfig({
			NODE_ENV: 'test',
			ZEEPKIST_LOBBY_ENABLED: 'true',
			ZEEPKIST_LOBBY_HOST: '127.0.0.1',
			ZEEPKIST_LOBBY_BUILD: '2043',
			ZEEPKIST_ROOM_BROKER_ENABLED: 'true',
		}),
	).toThrow('ZEEPKIST_ROOM_BROKER_TOKEN is required')
})

test('lobby host config requires broker token only when enabled', () => {
	expect(parseLobbyHostConfig({ NODE_ENV: 'test' }).enabled).toBe(false)
	expect(() =>
		parseLobbyHostConfig({ NODE_ENV: 'test', ZEEPKIST_TOTW_HOST_ENABLED: 'true' }),
	).toThrow('ZEEPKIST_ROOM_BROKER_TOKEN is required')
	const config = parseLobbyHostConfig({
		NODE_ENV: 'test',
		ZEEPKIST_TOTW_HOST_ENABLED: 'true',
		ZEEPKIST_ROOM_BROKER_TOKEN: 'x'.repeat(32),
	})
	expect(config.enabled).toBe(true)
	expect(config.brokerUrl).toBe('http://localhost:3001')
	expect(config.roundTimeSeconds).toBe(900)
	expect(config.graphqlWsUrl).toBe('ws://localhost:5000')
	expect(config.messageRefreshMs).toBe(600_000)
	expect(() =>
		parseLobbyHostConfig({
			NODE_ENV: 'test',
			ZEEPKIST_TOTW_MESSAGE_REFRESH_MS: '59000',
		}),
	).toThrow()
})

test('database config parses without server-only secrets', () => {
	const config = parseDatabaseConfig({})

	expect(config.databaseUrl).toBe('postgres://postgres:postgres@localhost:5432/zeepkist')
	expect(config.databaseTimeouts).toEqual({
		connectMs: undefined,
		statementMs: undefined,
		lockMs: undefined,
		idleTransactionMs: undefined,
	})
	expect(config.wasabi.ghostFolder).toBe('ghosts-dev')
	expect(config.wasabi.thumbnailFolder).toBe('thumbnails-dev')
})

test('jobs config parses without cache configuration', () => {
	const config = parseJobsConfig({})

	expect(config.databaseUrl).toBe('postgres://postgres:postgres@localhost:5432/zeepkist')
	expect(config.databaseTimeouts).toEqual({
		connectMs: 5000,
		statementMs: 300000,
		lockMs: 30000,
		idleTransactionMs: 60000,
	})
	expect(config.queuePoolMax).toBe(2)
})

test('jobs config accepts bounded database timeouts', () => {
	const config = parseJobsConfig({
		DATABASE_CONNECT_TIMEOUT_MS: '2500',
		DATABASE_STATEMENT_TIMEOUT_MS: '180000',
		DATABASE_LOCK_TIMEOUT_MS: '20000',
		DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: '45000',
	})

	expect(config.databaseTimeouts).toEqual({
		connectMs: 2500,
		statementMs: 180000,
		lockMs: 20000,
		idleTransactionMs: 45000,
	})
})

test('jobs config accepts a custom queue pool maximum', () => {
	const config = parseJobsConfig({ JOBS_QUEUE_POOL_MAX: '4' })

	expect(config.queuePoolMax).toBe(4)
})

test.each(['0', '-1', '1.5', 'invalid'])('jobs config rejects queue pool maximum %s', (value) => {
	expect(() => parseJobsConfig({ JOBS_QUEUE_POOL_MAX: value })).toThrow()
})

test('import config preserves super league candidate fallback', () => {
	const config = parseImportZslConfig({})

	expect(config.superLeagueData).toBe('/data/super_league_data')
})

test('migrate config preserves migration candidate fallback', () => {
	const config = parseMigrateConfig({})

	expect(config.migrationsFolder).toBe(resolve(process.cwd(), 'packages/database/drizzle'))
})

test('postgraphile config accepts a separate development schema-watch connection', () => {
	const config = parsePostgraphileConfig({
		NODE_ENV: 'development',
		POSTGRAPHILE_DATABASE_URL: 'postgres://zeepcentraal_graphql:secret@localhost:5432/zeepkist',
		DATABASE_URL: 'postgres://postgres:secret@localhost:5432/zeepkist',
		POSTGRAPHILE_SUPERUSER_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/zeepkist',
	})

	expect(config.databaseUrl).toBe(
		'postgres://zeepcentraal_graphql:secret@localhost:5432/zeepkist',
	)
	expect(config.superuserDatabaseUrl).toBe('postgres://postgres:postgres@localhost:5432/zeepkist')
	expect(config.databaseTimeouts).toEqual({
		connectMs: 5000,
		statementMs: 15000,
		lockMs: 3000,
		idleTransactionMs: 30000,
	})
	expect(config.readiness).toEqual({ timeoutMs: 2000, cacheMs: 1000 })
})

test('postgraphile config accepts bounded database and readiness timeouts', () => {
	const config = parsePostgraphileConfig({
		NODE_ENV: 'test',
		POSTGRAPHILE_DATABASE_CONNECT_TIMEOUT_MS: '2500',
		POSTGRAPHILE_DATABASE_STATEMENT_TIMEOUT_MS: '12000',
		POSTGRAPHILE_DATABASE_LOCK_TIMEOUT_MS: '1500',
		POSTGRAPHILE_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: '20000',
		POSTGRAPHILE_READINESS_TIMEOUT_MS: '750',
		POSTGRAPHILE_READINESS_CACHE_MS: '250',
	})

	expect(config.databaseTimeouts).toEqual({
		connectMs: 2500,
		statementMs: 12000,
		lockMs: 1500,
		idleTransactionMs: 20000,
	})
	expect(config.readiness).toEqual({ timeoutMs: 750, cacheMs: 250 })
})

test('postgraphile config defaults bounded pools, caches, and live operations', () => {
	const config = parsePostgraphileConfig({ NODE_ENV: 'test' })

	expect(config.databasePoolMax).toBe(6)
	expect(config.cacheMaxEntries).toBe(128)
	expect(config.operationPlansPerOperation).toBe(8)
	expect(config.liveQueries.maxOperations).toBe(512)
	expect(config.liveQueries.maxOperationsPerConnection).toBe(16)
	expect(config.liveQueries.maxConcurrentExecutions).toBe(4)
	expect(config.maxRequestBodySize).toBe(256 * 1024)
	expect(config.maxQueryBytes).toBe(64 * 1024)
	expect(config.httpAdmission).toEqual({ maxConcurrent: 64, maxQueued: 256 })
	expect(config.liveQueries.maxMessageBytes).toBe(256 * 1024)
	expect(config.liveQueries.maxPendingMessagesPerConnection).toBe(32)
	expect(config.liveQueries.resultCacheMaxBytes).toBe(16 * 1024 * 1024)
	expect(config.liveQueries.maxResultBytes).toBe(2 * 1024 * 1024)
})

test('postgraphile config accepts custom runtime memory controls', () => {
	const config = parsePostgraphileConfig({
		NODE_ENV: 'test',
		POSTGRAPHILE_DATABASE_POOL_MAX: '4',
		POSTGRAPHILE_CACHE_MAX_ENTRIES: '64',
		POSTGRAPHILE_OPERATION_PLANS_PER_OPERATION: '6',
		POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS: '128',
		POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS_PER_CONNECTION: '12',
		POSTGRAPHILE_LIVE_QUERY_MAX_CONCURRENT_EXECUTIONS: '3',
		POSTGRAPHILE_MAX_REQUEST_BODY_SIZE: '131072',
		POSTGRAPHILE_MAX_QUERY_BYTES: '32768',
		POSTGRAPHILE_HTTP_MAX_CONCURRENT_REQUESTS: '96',
		POSTGRAPHILE_HTTP_MAX_QUEUED_REQUESTS: '384',
		POSTGRAPHILE_LIVE_QUERY_MAX_MESSAGE_BYTES: '65536',
		POSTGRAPHILE_LIVE_QUERY_MAX_PENDING_MESSAGES_PER_CONNECTION: '12',
		POSTGRAPHILE_LIVE_QUERY_RESULT_CACHE_MAX_BYTES: '1048576',
		POSTGRAPHILE_LIVE_QUERY_MAX_RESULT_BYTES: '262144',
	})

	expect(config.databasePoolMax).toBe(4)
	expect(config.cacheMaxEntries).toBe(64)
	expect(config.operationPlansPerOperation).toBe(6)
	expect(config.liveQueries.maxOperations).toBe(128)
	expect(config.liveQueries.maxOperationsPerConnection).toBe(12)
	expect(config.liveQueries.maxConcurrentExecutions).toBe(3)
	expect(config.maxRequestBodySize).toBe(131072)
	expect(config.maxQueryBytes).toBe(32768)
	expect(config.httpAdmission).toEqual({ maxConcurrent: 96, maxQueued: 384 })
	expect(config.liveQueries.maxMessageBytes).toBe(65536)
	expect(config.liveQueries.maxPendingMessagesPerConnection).toBe(12)
	expect(config.liveQueries.resultCacheMaxBytes).toBe(1048576)
	expect(config.liveQueries.maxResultBytes).toBe(262144)
})

test('postgraphile config rejects a superuser connection in production', () => {
	expect(() =>
		parsePostgraphileConfig({
			NODE_ENV: 'production',
			DATABASE_URL: 'postgres://zeepcentraal_graphql:secret@database:5432/zeepkist',
			POSTGRAPHILE_SUPERUSER_DATABASE_URL:
				'postgres://postgres:postgres@database:5432/zeepkist',
		}),
	).toThrow('POSTGRAPHILE_SUPERUSER_DATABASE_URL is forbidden in production')
})

test('production server config rejects weak secrets', () => {
	expect(() =>
		parseServerConfig({
			NODE_ENV: 'production',
			JWT_SECRET: 'x'.repeat(32),
			TRIGGER_JOB_TOKEN: 'trigger-token',
			DISCORD_BOT_API_TOKEN: 'd'.repeat(32),
		}),
	).toThrow('TRIGGER_JOB_TOKEN must contain at least 32 non-placeholder characters')
})
