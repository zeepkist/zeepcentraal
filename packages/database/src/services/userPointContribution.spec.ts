import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { sortedUniqueUserIds } from './userPointContributionHelpers'

test('user contribution lock targets are sorted and unique', () => {
	expect(sortedUniqueUserIds([9, 2, 9, 4, 2])).toEqual([2, 4, 9])
})

test('player persistence owns only derived fields and validates its snapshot', () => {
	const service = readFileSync(new URL('./userPointContribution.ts', import.meta.url), 'utf8')
	const functionStart = service.indexOf('export async function persistUserPointScore')
	const functionEnd = service.indexOf(
		'export async function syncUserPointContributionLevels',
		functionStart,
	)
	const playerPersistence = service.slice(functionStart, functionEnd)

	expect(functionStart).toBeGreaterThan(-1)
	expect(playerPersistence).toContain('return db.transaction(async (tx) => {')
	expect(playerPersistence).toContain('contributionSnapshotMatches(tx, input)')
	expect(playerPersistence).toContain('UPDATE ')
	expect(playerPersistence).toContain(' AS target')
	expect(playerPersistence).toContain('contribution_rank = source.contribution_rank')
	expect(playerPersistence).toContain('player_decayed_points = source.player_decayed_points')
	expect(playerPersistence).toContain('IS NOT DISTINCT FROM ROW(')
	expect(playerPersistence).toContain('IS DISTINCT FROM ROW(')
	expect(playerPersistence).toContain('INSERT INTO $' + '{userPoints}')
	expect(playerPersistence).not.toContain('DELETE FROM')
	expect(playerPersistence).not.toContain('pg_advisory_xact_lock')
})

test('projection backfill ranks every positive-point personal best without cap', () => {
	const migration = readFileSync(
		new URL('../../drizzle/0071_backfill_player_score_contributions.sql', import.meta.url),
		'utf8',
	)

	expect(migration).toContain('FROM public.personal_best_global AS personal_best')
	expect(migration).toContain('WHERE level_score.points > 0')
	expect(migration).toContain('RANK() OVER')
	expect(migration).toContain('ROW_NUMBER() OVER')
	expect(migration).toContain('0.985::double precision')
	expect(migration).toContain('0.95::double precision')
	expect(migration).toContain('LN(1.401298464324817e-45::double precision)')
	expect(migration).toContain('THEN 0::double precision')
	expect(migration).not.toContain('LIMIT')
	expect(migration).not.toContain('2000')
})
