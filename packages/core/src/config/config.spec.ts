import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { parseDatabaseConfig } from './database'
import { parseImportZslConfig } from './importZsl'
import { parseMigrateConfig } from './migrate'
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
	expect(config.ghost.folder).toBe('ghosts-dev')
})

test('import config preserves super league candidate fallback', () => {
	const config = parseImportZslConfig({})

	expect(config.superLeagueData).toBe('/data/super_league_data')
})

test('migrate config preserves migration candidate fallback', () => {
	const config = parseMigrateConfig({})

	expect(config.migrationsFolder).toBe(resolve(process.cwd(), 'packages/database/drizzle'))
})

test('production server config rejects weak secrets', () => {
	expect(() =>
		parseServerConfig({
			NODE_ENV: 'production',
			JWT_SECRET: 'x'.repeat(32),
			TRIGGER_JOB_TOKEN: 'trigger-token',
		}),
	).toThrow('TRIGGER_JOB_TOKEN must contain at least 32 non-placeholder characters')
})
