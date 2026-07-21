import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const lockQueries: unknown[] = []
const insertBatchSizes: number[] = []
const conflictUpdates: unknown[] = []
const deleteQueries: unknown[] = []
let existingRows: Array<{
	contributionRank: number
	idLevel: number
	idRecord: number
	idUser: number
	levelDecayedPoints: number
	levelPoints: number
	levelPosition: number
	playerDecayedPoints: number
}> = []
const execute = mock(async (query: unknown) => {
	lockQueries.push(query)
})
const select = mock(() => ({
	from: () => ({
		where: () => ({
			orderBy: async () => existingRows,
		}),
	}),
}))
const deleteRows = mock(() => ({
	where: async (query: unknown) => {
		deleteQueries.push(query)
	},
}))
const insert = mock(() => ({
	values: (rows: unknown[]) => ({
		onConflictDoUpdate: async (config: unknown) => {
			insertBatchSizes.push(rows.length)
			conflictUpdates.push(config)
			if (insertBatchSizes.length === 2) throw new Error('insert failed')
		},
	}),
}))
const tx = { delete: deleteRows, execute, insert, select }
const transaction = mock(async (callback: (value: typeof tx) => Promise<void>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const {
	clearUserPointContributions,
	USER_POINT_CONTRIBUTION_LOCK_BUCKETS,
	upsertUserPointContributionsBulk,
} = await import('./userPointContribution')

beforeEach(() => {
	lockQueries.length = 0
	insertBatchSizes.length = 0
	conflictUpdates.length = 0
	deleteQueries.length = 0
	existingRows = []
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

	await expect(
		upsertUserPointContributionsBulk([
			{ idUser: 9, contributions },
			{ idUser: 2, contributions: [] },
		]),
	).rejects.toThrow('insert failed')

	expect(transaction).toHaveBeenCalledTimes(1)
	expect(lockQueries).toHaveLength(1)
	const lockQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(lockQuery.sql).toContain('FROM unnest($2::integer[])')
	expect(lockQuery.sql).toContain('ORDER BY locked_user.id_user')
	expect(lockQuery.params).toEqual([1_516_438_864, [2, 9]])
	expect(insertBatchSizes).toEqual([5000, 1])
})

test('upserts changed rows and deletes only contributions removed from desired state', async () => {
	existingRows = [
		{
			idUser: 7,
			idLevel: 10,
			idRecord: 100,
			contributionRank: 1,
			levelPosition: 1,
			levelPoints: 100,
			levelDecayedPoints: 100,
			playerDecayedPoints: 100,
		},
		{
			idUser: 7,
			idLevel: 20,
			idRecord: 200,
			contributionRank: 2,
			levelPosition: 2,
			levelPoints: 90,
			levelDecayedPoints: 80,
			playerDecayedPoints: 70,
		},
	]

	await upsertUserPointContributionsBulk([
		{
			idUser: 7,
			contributions: [
				{
					idLevel: 10,
					idRecord: 100,
					contributionRank: 1,
					levelPosition: 1,
					levelPoints: 110,
					levelDecayedPoints: 110,
					playerDecayedPoints: 110,
				},
			],
		},
	])

	expect(insertBatchSizes).toEqual([1])
	expect(conflictUpdates).toHaveLength(1)
	const conflictWhere = new PgDialect().sqlToQuery((conflictUpdates[0] as { where: SQL }).where)
	expect(conflictWhere.sql).toContain('IS DISTINCT FROM')
	expect(deleteQueries).toHaveLength(1)
	const deleteQuery = new PgDialect().sqlToQuery(deleteQueries[0] as SQL)
	expect(deleteQuery.params).toEqual([7, 20])
	expect(deleteQuery.sql).toContain('("user_point_contribution"."id_user"')
})

test('skips all contribution writes when fingerprints match', async () => {
	existingRows = [
		{
			idUser: 7,
			idLevel: 10,
			idRecord: 100,
			contributionRank: 1,
			levelPosition: 1,
			levelPoints: 100,
			levelDecayedPoints: 100,
			playerDecayedPoints: 100,
		},
	]

	await upsertUserPointContributionsBulk([
		{
			idUser: 7,
			contributions: existingRows.map(({ idUser: _, ...contribution }) => contribution),
		},
	])

	expect(insertBatchSizes).toEqual([])
	expect(deleteQueries).toEqual([])
})

test('acquires thousands of sorted user locks with one query', async () => {
	const idUsers = Array.from({ length: 8_438 }, (_, index) => 8_438 - index)

	await clearUserPointContributions(idUsers)

	expect(lockQueries).toHaveLength(1)
	const lockQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(lockQuery.params[1]).toHaveLength(USER_POINT_CONTRIBUTION_LOCK_BUCKETS)
	expect(lockQuery.params[1]).toEqual(
		Array.from({ length: USER_POINT_CONTRIBUTION_LOCK_BUCKETS }, (_, index) => index),
	)
})

test('acquires fifty user locks with one ordered query', async () => {
	await clearUserPointContributions(Array.from({ length: 50 }, (_, index) => 50 - index))

	expect(lockQueries).toHaveLength(1)
	const lockQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(lockQuery.params[1]).toEqual(Array.from({ length: 50 }, (_, index) => index + 1))
	expect(lockQuery.sql).toContain('ORDER BY locked_user.id_user')
})
