import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const queries: SQL[] = []
let previousRanks: Array<{ idUser: number; previousRank: number }> = []
const values = mock(async () => {})
const insert = mock(() => ({ values }))
const execute = mock(async (query: SQL) => {
	queries.push(query)
	const compiled = new PgDialect().sqlToQuery(query)
	return compiled.sql.includes('AS "previousRank"') ? previousRanks : []
})
const tx = { execute, insert }
const transaction = mock(async (callback: (value: typeof tx) => Promise<void>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const { resetInactiveUserScores } = await import('./userPoints')

beforeEach(() => {
	queries.length = 0
	previousRanks = []
	execute.mockClear()
	insert.mockClear()
	values.mockClear()
	transaction.mockClear()
})

test('atomically resets inactive aggregate and contribution ranked points without advisory locks', async () => {
	previousRanks = [{ idUser: 9, previousRank: 4 }]

	await resetInactiveUserScores([9, 2, 9])

	expect(transaction).toHaveBeenCalledTimes(1)
	expect(queries).toHaveLength(3)

	const previousRankQuery = new PgDialect().sqlToQuery(queries[0] as SQL)
	expect(previousRankQuery.sql).toContain('AS "previousRank"')
	expect(previousRankQuery.params).toEqual([[2, 9]])

	const aggregateQuery = new PgDialect().sqlToQuery(queries[1] as SQL)
	expect(aggregateQuery.sql).toContain('SET points = 0, rank = -1, date_updated = NOW()')
	expect(aggregateQuery.sql).toContain('ROW(points, rank) IS DISTINCT FROM ROW(0, -1)')
	expect(aggregateQuery.params).toEqual([[2, 9]])

	const contributionQuery = new PgDialect().sqlToQuery(queries[2] as SQL)
	expect(contributionQuery.sql).toContain(
		'SET player_decayed_points = 0, date_calculated = NOW()',
	)
	expect(contributionQuery.sql).toContain('player_decayed_points IS DISTINCT FROM 0::real')
	expect(contributionQuery.params).toEqual([[2, 9]])

	expect(values).toHaveBeenCalledWith({
		kind: 'rank_batch',
		payload: { changes: [{ idUser: 9, previousRank: 4, rank: -1 }] },
	})
})

test('resets inactive users in transactions of 50', async () => {
	await resetInactiveUserScores(Array.from({ length: 51 }, (_, index) => index + 1))

	expect(transaction).toHaveBeenCalledTimes(2)
	expect(queries).toHaveLength(6)
	expect(new PgDialect().sqlToQuery(queries[0] as SQL).params).toEqual([
		Array.from({ length: 50 }, (_, index) => index + 1),
	])
	expect(new PgDialect().sqlToQuery(queries[3] as SQL).params).toEqual([[51]])
})

test('does not open a transaction without inactive users', async () => {
	await resetInactiveUserScores([])

	expect(transaction).not.toHaveBeenCalled()
})
