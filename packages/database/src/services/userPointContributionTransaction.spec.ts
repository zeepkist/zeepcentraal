import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const lockQueries: unknown[] = []
let affectedProjectionUsers: Array<{ idUser: number }> = []
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
	if (compiled.sql.includes('AS matches')) return [{ matches: true }]
	return compiled.sql.includes('SELECT DISTINCT affected.id_user') ? affectedProjectionUsers : []
})
const tx = { execute }
const transaction = mock(async (callback: (value: typeof tx) => Promise<void>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const { persistUserPointScore, syncUserPointContributionLevels } = await import(
	'./userPointContribution'
)

beforeEach(() => {
	lockQueries.length = 0
	affectedProjectionUsers = []
	failSecondPlayerUpdate = false
	playerUpdateCount = 0
	transaction.mockClear()
})

test('validates one user snapshot and propagates chunk failure for transaction rollback', async () => {
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
		persistUserPointScore({ idUser: 9, contributions, points: 100, totalPoints: 200 }),
	).rejects.toThrow('update failed')

	expect(transaction).toHaveBeenCalledTimes(1)
	expect(lockQueries).toHaveLength(3)
	const snapshotQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(snapshotQuery.sql).toContain('FULL OUTER JOIN current_contributions')
	expect(snapshotQuery.sql).toContain('AS matches')
	expect(snapshotQuery.sql).toContain('FROM UNNEST(')
	expect(snapshotQuery.sql).not.toContain('AS (VALUES')
	expect(snapshotQuery.params).toHaveLength(6)
	expect(snapshotQuery.params[0]).toHaveLength(5001)
	expect(snapshotQuery.params[4]).toHaveLength(5001)
	expect(new PgDialect().sqlToQuery(lockQueries[1] as SQL).params).toHaveLength(40_000)
	expect(new PgDialect().sqlToQuery(lockQueries[2] as SQL).params).toHaveLength(8)
})

test('updates player fields with float4-compatible level snapshot values', async () => {
	await persistUserPointScore({
		idUser: 7,
		points: 500,
		totalPoints: 750,
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
	})

	expect(lockQueries).toHaveLength(3)
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
	const aggregateQuery = new PgDialect().sqlToQuery(lockQueries[2] as SQL)
	expect(aggregateQuery.sql).toContain('INSERT INTO "user_points"')
	expect(aggregateQuery.sql).toContain('ON CONFLICT (id_user) DO UPDATE')
})

test('does not insert or delete rows for users without projected contributions', async () => {
	await persistUserPointScore({ idUser: 7, contributions: [], points: 0, totalPoints: 0 })

	expect(lockQueries).toHaveLength(2)
	expect(
		lockQueries.some((query) =>
			new PgDialect()
				.sqlToQuery(query as SQL)
				.sql.includes('UPDATE "user_point_contribution" AS target'),
		),
	).toBe(false)
})

test('syncs uncapped level contribution projection without advisory locks', async () => {
	affectedProjectionUsers = [{ idUser: 9 }, { idUser: 2 }]

	const result = await syncUserPointContributionLevels([8, 7, 8])

	expect(result).toEqual({ idUsers: [2, 9], levels: 2, users: 2 })
	expect(lockQueries).toHaveLength(3)
	const affectedQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(affectedQuery.sql).toContain('ANY($1::integer[])')
	expect(affectedQuery.params).toEqual([
		[7, 8],
		[7, 8],
	])

	const upsertQuery = new PgDialect().sqlToQuery(lockQueries[1] as SQL)
	expect(upsertQuery.sql).toContain('RANK() OVER')
	expect(upsertQuery.sql).toContain('ON CONFLICT (id_user, id_level) DO UPDATE')
	expect(upsertQuery.sql).toContain('2147483647')
	expect(upsertQuery.sql).not.toContain('LIMIT')

	const deleteQuery = new PgDialect().sqlToQuery(lockQueries[2] as SQL)
	expect(deleteQuery.sql).toContain('DELETE FROM "user_point_contribution" AS contribution')
	expect(deleteQuery.sql).toContain('NOT EXISTS')
	expect(
		lockQueries.every(
			(query) =>
				!new PgDialect().sqlToQuery(query as SQL).sql.includes('pg_advisory_xact_lock'),
		),
	).toBe(true)
})
