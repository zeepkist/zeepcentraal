import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const queries: SQL[] = []
const values = mock(async () => {})
const insert = mock(() => ({ values }))
const execute = mock(async (query: SQL) => {
	queries.push(query)
	return []
})
const tx = { execute, insert }
const transaction = mock(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const { USER_SCORE_WRITE_BATCH_SIZE, updateUserRanks } = await import('./userPoints')

beforeEach(() => {
	queries.length = 0
	execute.mockClear()
	insert.mockClear()
	values.mockClear()
	transaction.mockClear()
})

test('updates global ranks in transactions of 50', async () => {
	const onBatchCompleted = mock((_processed: number, _total: number) => {})
	const entries = Array.from({ length: 51 }, (_, index) => ({
		idUser: index + 1,
		rank: index + 1,
	}))

	await updateUserRanks(entries, onBatchCompleted)

	expect(USER_SCORE_WRITE_BATCH_SIZE).toBe(50)
	expect(transaction).toHaveBeenCalledTimes(2)
	expect(queries).toHaveLength(2)
	expect(new PgDialect().sqlToQuery(queries[0] as SQL).params).toHaveLength(100)
	expect(new PgDialect().sqlToQuery(queries[1] as SQL).params).toHaveLength(2)
	expect(onBatchCompleted.mock.calls).toEqual([
		[50, 51],
		[51, 51],
	])
})

test('does not open a rank transaction without entries', async () => {
	await updateUserRanks([])

	expect(transaction).not.toHaveBeenCalled()
})
