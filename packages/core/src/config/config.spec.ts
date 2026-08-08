import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { parseDatabaseConfig } from './database'
import { parseImportZslConfig } from './importZsl'
import { parseJobsConfig } from './jobs'
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
	})

	expect(config.api.maxRequestBodySize).toBe(16 * 1024 * 1024)
})

test('database config parses without server-only secrets', () => {
	const config = parseDatabaseConfig({})

	expect(config.databaseUrl).toBe('postgres://postgres:postgres@localhost:5432/zeepkist')
	expect(config.wasabi.ghostFolder).toBe('ghosts-dev')
	expect(config.wasabi.thumbnailFolder).toBe('thumbnails-dev')
})

test('jobs config parses without cache configuration', () => {
	const config = parseJobsConfig({})

	expect(config.databaseUrl).toBe('postgres://postgres:postgres@localhost:5432/zeepkist')
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
	expect(config.liveQueries.maxOperations).toBe(256)
})

test('postgraphile config accepts custom runtime memory controls', () => {
	const config = parsePostgraphileConfig({
		NODE_ENV: 'test',
		POSTGRAPHILE_DATABASE_POOL_MAX: '4',
		POSTGRAPHILE_CACHE_MAX_ENTRIES: '64',
		POSTGRAPHILE_OPERATION_PLANS_PER_OPERATION: '6',
		POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS: '128',
	})

	expect(config.databasePoolMax).toBe(4)
	expect(config.cacheMaxEntries).toBe(64)
	expect(config.operationPlansPerOperation).toBe(6)
	expect(config.liveQueries.maxOperations).toBe(128)
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
