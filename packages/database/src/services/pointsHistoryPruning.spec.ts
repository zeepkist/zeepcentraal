import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

type State = {
	budgetDate: string
	deletedToday: number
	weekStart: string
}

let state: State = {
	budgetDate: '2026-08-31',
	deletedToday: 0,
	weekStart: '2026-07-27 00:00:00+00',
}
let eligible = true
let deleteCount = 0
const queries: SQL[] = []

const execute = mock(async (query: SQL) => {
	queries.push(query)
	const compiled = new PgDialect().sqlToQuery(query)
	if (compiled.sql.includes('SELECT\n\t\t\tbudget_date::text')) return [state]
	if (compiled.sql.includes('SET budget_date =')) {
		state = { ...state, budgetDate: '2026-08-31', deletedToday: 0 }
		return [state]
	}
	if (compiled.sql.includes("INTERVAL '1 week') <=")) return [{ eligible }]
	if (compiled.sql.includes('SELECT COUNT(*)::integer AS count FROM deleted')) {
		return [{ count: deleteCount }]
	}
	if (compiled.sql.includes('SET week_start = COALESCE')) {
		state = { ...state, weekStart: '2026-08-03 00:00:00+00' }
		return [{ weekStart: state.weekStart }]
	}
	return []
})
const tx = { execute }
const transaction = mock(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const {
	buildLevelPointsHistoryPruneQuery,
	buildUserPointsHistoryPruneQuery,
	prunePointsHistoryBatch,
} = await import('./pointsHistoryPruning')

function compile(query: SQL) {
	return new PgDialect().sqlToQuery(query)
}

beforeEach(() => {
	state = {
		budgetDate: '2026-08-31',
		deletedToday: 0,
		weekStart: '2026-07-27 00:00:00+00',
	}
	eligible = true
	deleteCount = 0
	queries.length = 0
	execute.mockClear()
	transaction.mockClear()
})

test('level pruning keeps latest zero row, otherwise highest points with latest tie-break', () => {
	const query = compile(
		buildLevelPointsHistoryPruneQuery('2026-07-27T00:00:00.000Z', 200, 10_000),
	)

	expect(query.sql).toContain('FIRST_VALUE(history.points) OVER')
	expect(query.sql).toContain(
		'CASE WHEN annotated.latest_points = 0 THEN annotated.date_created END DESC NULLS LAST',
	)
	expect(query.sql).toContain(
		'CASE WHEN annotated.latest_points <> 0 THEN annotated.points END DESC NULLS LAST',
	)
	expect(query.sql).toContain('annotated.date_created DESC')
	expect(query.sql).toContain('annotated.id DESC')
	expect(query.sql).toContain('HAVING COUNT(*) > 1')
	expect(query.params).toContain(200)
	expect(query.params).toContain(10_000)
})

test('user pruning prefers lowest positive rank and latest deterministic tie-break', () => {
	const query = compile(buildUserPointsHistoryPruneQuery('2026-07-27T00:00:00.000Z', 200, 10_000))

	expect(query.sql).toContain('CASE WHEN history.rank > 0 THEN 0 ELSE 1 END')
	expect(query.sql).toContain('CASE WHEN history.rank > 0 THEN history.rank END ASC NULLS LAST')
	expect(query.sql).toContain('history.date_created DESC')
	expect(query.sql).toContain('history.id DESC')
	expect(query.sql).toContain("history.date_created < $2::timestamptz + INTERVAL '1 week'")
})

test('persists deletion count and enforces remaining retry-safe daily budget', async () => {
	state.deletedToday = 249_999
	deleteCount = 1

	const result = await prunePointsHistoryBatch({
		history: 'level_points_history',
		pruneBefore: '2026-08-03T00:00:00.000Z',
		budgetDate: '2026-08-31',
		dailyDeleteLimit: 250_000,
		batchDeleteLimit: 10_000,
		entityLimit: 200,
	})

	expect(result).toEqual({
		advancedWeeks: 0,
		capReached: true,
		complete: false,
		deletedRows: 1,
		weekStart: '2026-07-27 00:00:00+00',
	})
	const deleteQuery = queries
		.map(compile)
		.find((query) => query.sql.includes('SELECT COUNT(*)::integer AS count FROM deleted'))
	expect(deleteQuery?.params).toContain(1)
	expect(queries.map(compile).some((query) => query.sql.includes('deleted_today +'))).toBe(true)
})

test('advances watermark only after eligible week has no duplicates', async () => {
	const result = await prunePointsHistoryBatch({
		history: 'user_points_history',
		pruneBefore: '2026-08-03T00:00:00.000Z',
		budgetDate: '2026-08-31',
		dailyDeleteLimit: 250_000,
		batchDeleteLimit: 10_000,
		entityLimit: 200,
	})

	expect(result).toEqual({
		advancedWeeks: 1,
		capReached: false,
		complete: false,
		deletedRows: 0,
		weekStart: '2026-08-03 00:00:00+00',
	})
	expect(
		queries.map(compile).some((query) => query.sql.includes('SET week_start = COALESCE')),
	).toBe(true)
})

test('leaves incomplete week untouched and resets budget on a new UTC date', async () => {
	state.budgetDate = '2026-08-30'
	eligible = false

	const result = await prunePointsHistoryBatch({
		history: 'level_points_history',
		pruneBefore: '2026-08-02T12:00:00.000Z',
		budgetDate: '2026-08-31',
		dailyDeleteLimit: 250_000,
		batchDeleteLimit: 10_000,
		entityLimit: 200,
	})

	expect(result.complete).toBe(true)
	expect(result.deletedRows).toBe(0)
	expect(queries.map(compile).some((query) => query.sql.includes('SET budget_date ='))).toBe(true)
	expect(queries.map(compile).some((query) => query.sql.includes('DELETE FROM'))).toBe(false)
})
