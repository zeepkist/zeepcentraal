import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	assertLocalTournamentSeedAllowed,
	LOCAL_TOURNAMENT_LEVEL_XX_HASH,
} from './localTrackTournamentSeed'

test('local tournament seed accepts loopback databases only outside production', () => {
	expect(() =>
		assertLocalTournamentSeedAllowed(
			'development',
			'postgres://postgres:postgres@localhost:5432/zeepkist',
		),
	).not.toThrow()
	expect(() =>
		assertLocalTournamentSeedAllowed(
			'test',
			'postgres://postgres:postgres@127.0.0.1:5432/zeepkist',
		),
	).not.toThrow()
	expect(() =>
		assertLocalTournamentSeedAllowed(
			'production',
			'postgres://postgres:postgres@localhost:5432/zeepkist',
		),
	).toThrow('forbidden in production')
	expect(() =>
		assertLocalTournamentSeedAllowed(
			'development',
			'postgres://postgres:postgres@database:5432/zeepkist',
		),
	).toThrow('requires localhost database')
})

test('local demo hash stays outside migrations', async () => {
	const glob = new Bun.Glob('*.sql')
	const migrationsDirectory = fileURLToPath(new URL('../../drizzle/', import.meta.url))
	for await (const path of glob.scan(migrationsDirectory)) {
		expect(await Bun.file(join(migrationsDirectory, path)).text()).not.toContain(
			LOCAL_TOURNAMENT_LEVEL_XX_HASH,
		)
	}
})

test('local seed advances demo rows without retaining prior-period results', async () => {
	const service = await Bun.file(
		new URL('../services/trackTournament.ts', import.meta.url),
	).text()
	expect(service).toContain('existing?.startAt === period.start.toISOString()')
	expect(service).toContain('.delete(trackTournamentResult)')
	expect(service).toContain('finalizedAt: null')
})
