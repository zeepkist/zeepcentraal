import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const lockQueries: unknown[] = []
let affectedProjectionUsers: Array<{ idUser: number }> = []
let fallbackLevels: Array<{ idLevel: number }> = []
let changedRows = 0
let deletedRows = 0
let failSecondPlayerUpdate = false
let playerUpdateCount = 0
const execute = mock(async (query: unknown) => {
	lockQueries.push(query)
	const compiled = new PgDialect().sqlToQuery(query as SQL)
	if (compiled.sql.includes('UPDATE "user_point_contribution" AS target')) {
		playerUpdateCount++
		if (failSecondPlayerUpdate && playerUpdateCount === 2) {
			throw new Error('update failed')
		}
	}
	if (compiled.sql.includes('SELECT "level_points"."id_level" AS "idLevel"')) {
		return fallbackLevels
	}
	if (compiled.sql.includes('SELECT COUNT(*)::integer AS count FROM updated')) {
		return [{ count: changedRows }]
	}
	if (compiled.sql.includes('SELECT COUNT(*)::integer AS count FROM deleted')) {
		return [{ count: deletedRows }]
	}
	return compiled.sql.includes('SELECT DISTINCT affected.id_user') ? affectedProjectionUsers : []
})
const tx = { execute }
const transaction = mock(async (callback: (value: typeof tx) => Promise<void>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const {
	syncChangedLevelPointContributionValues,
	syncUserPointContributionLevels,
	updateUserPointContributionPlayerValuesBulk,
} = await import('./userPointContribution')

beforeEach(() => {
	lockQueries.length = 0
	affectedProjectionUsers = []
	fallbackLevels = []
	changedRows = 0
	deletedRows = 0
	failSecondPlayerUpdate = false
	playerUpdateCount = 0
	transaction.mockClear()
})

test('locks affected users and propagates chunk failure for transaction rollback', async () => {
	const contributions = Array.from({ length: 5001 }, (_, index) => ({
		contributionRank: index + 1,
		idLevel: index + 1,
		idRecord: index + 1000,
		levelDecayedPoints: 100,
		levelPoints: 100,
		levelPosition: 1,
		playerDecayedPoints: 100,
	}))
	failSecondPlayerUpdate = true

	await expect(
		updateUserPointContributionPlayerValuesBulk([
			{ idUser: 9, contributions },
			{ idUser: 2, contributions: [] },
		]),
	).rejects.toThrow('update failed')

	expect(transaction).toHaveBeenCalledTimes(1)
	expect(lockQueries).toHaveLength(3)
	const lockQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(lockQuery.sql).toContain('FROM unnest($2::integer[])')
	expect(lockQuery.sql).toContain('ORDER BY locked_user.id_user')
	expect(lockQuery.params).toEqual([1_516_438_864, [2, 9]])
	expect(new PgDialect().sqlToQuery(lockQueries[1] as SQL).params).toHaveLength(40_000)
	expect(new PgDialect().sqlToQuery(lockQueries[2] as SQL).params).toHaveLength(8)
})

test('updates player fields with float4-compatible level snapshot values', async () => {
	await updateUserPointContributionPlayerValuesBulk([
		{
			idUser: 7,
			contributions: [
				{
					idLevel: 10,
					idRecord: 100,
					contributionRank: 3,
					levelPosition: 27,
					levelPoints: 9368,
					levelDecayedPoints: 6323.9565,
					playerDecayedPoints: 5707.3706,
				},
			],
		},
	])

	expect(lockQueries).toHaveLength(2)
	const updateQuery = new PgDialect().sqlToQuery(lockQueries[1] as SQL)
	expect(updateQuery.sql).toContain('SET\n\t\t\t\t\tcontribution_rank = source.contribution_rank')
	expect(updateQuery.sql).toContain('player_decayed_points = source.player_decayed_points')
	expect(updateQuery.sql).toContain('IS NOT DISTINCT FROM ROW')
	expect(updateQuery.sql).toContain('IS DISTINCT FROM ROW')
	expect(updateQuery.sql).toContain('$6::real')
	expect(updateQuery.sql).toContain('$8::real')
	expect(updateQuery.sql).not.toContain('::double precision')
	expect(updateQuery.params[5]).toBe(6323.9565)
	expect(updateQuery.params[7]).toBe(5707.3706)
	expect(updateQuery.sql).not.toContain('id_record = source.id_record')
	expect(updateQuery.sql).not.toContain('INSERT INTO')
	expect(updateQuery.sql).not.toContain('DELETE FROM')
})

test('does not insert or delete rows for users without projected contributions', async () => {
	await updateUserPointContributionPlayerValuesBulk([{ idUser: 7, contributions: [] }])

	expect(lockQueries).toHaveLength(1)
})

test('syncs uncapped level contribution projection under ordered player locks', async () => {
	affectedProjectionUsers = [{ idUser: 9 }, { idUser: 2 }]

	const result = await syncUserPointContributionLevels([8, 7, 8])

	expect(result).toEqual({ idUsers: [2, 9], levels: 2, users: 2 })
	expect(lockQueries).toHaveLength(4)
	const affectedQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(affectedQuery.sql).toContain('ANY($1::integer[])')
	expect(affectedQuery.params).toEqual([
		[7, 8],
		[7, 8],
	])

	const lockQuery = new PgDialect().sqlToQuery(lockQueries[1] as SQL)
	expect(lockQuery.sql).toContain('ORDER BY locked_user.id_user')
	expect(lockQuery.params).toContainEqual([2, 9])

	const upsertQuery = new PgDialect().sqlToQuery(lockQueries[2] as SQL)
	expect(upsertQuery.sql).toContain('RANK() OVER')
	expect(upsertQuery.sql).toContain('ON CONFLICT (id_user, id_level) DO UPDATE')
	expect(upsertQuery.sql).toContain('2147483647')
	expect(upsertQuery.sql).not.toContain('LIMIT')

	const deleteQuery = new PgDialect().sqlToQuery(lockQueries[3] as SQL)
	expect(deleteQuery.sql).toContain('DELETE FROM "user_point_contribution" AS contribution')
	expect(deleteQuery.sql).toContain('NOT EXISTS')
})

test('syncs changed level-point values once and fully projects newly positive levels', async () => {
	fallbackLevels = [{ idLevel: 12 }]
	affectedProjectionUsers = [{ idUser: 2 }, { idUser: 9 }]
	changedRows = 25
	deletedRows = 3

	const result = await syncChangedLevelPointContributionValues()

	expect(result).toEqual({ deleted: 3, fallbackLevels: 1, updated: 25, users: 2 })
	const compiled = lockQueries.map((query) => new PgDialect().sqlToQuery(query as SQL))
	expect(compiled.filter((query) => query.sql.includes('pg_advisory_xact_lock'))).toHaveLength(1)
	const updateQuery = compiled.find((query) =>
		query.sql.includes('WITH updated AS (\n\t\t\t\tUPDATE "user_point_contribution"'),
	)
	expect(updateQuery?.sql).toContain('level_points = current_level.points')
	expect(updateQuery?.sql).toContain('level_decayed_points = CASE')
	expect(updateQuery?.sql).toContain('IS DISTINCT FROM ROW')
	const deleteQuery = compiled.find((query) =>
		query.sql.includes('SELECT COUNT(*)::integer AS count FROM deleted'),
	)
	expect(deleteQuery?.sql).toContain('FROM "level_points"')
	expect(deleteQuery?.sql).toContain('NOT EXISTS')
	const projectionQuery = compiled.find((query) => query.sql.includes('RANK() OVER'))
	expect(projectionQuery?.params).toContainEqual([12])
})
