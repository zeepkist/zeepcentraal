import { beforeEach, expect, mock, test } from 'bun:test'

const calls: Array<{ history: string }> = []
const counts = new Map<string, number>()
let failingHistory: string | undefined

const prunePointsHistoryBatch = mock(async (input: { history: string }) => {
	calls.push(input)
	if (input.history === failingHistory) throw new Error(`${input.history} failed`)
	const count = (counts.get(input.history) ?? 0) + 1
	counts.set(input.history, count)
	if (count === 1) {
		return {
			advancedWeeks: 1,
			capReached: false,
			complete: false,
			deletedRows: 10_000,
			weekStart: '2026-07-27 00:00:00+00',
		}
	}
	return {
		advancedWeeks: 0,
		capReached: true,
		complete: false,
		deletedRows: 0,
		weekStart: '2026-07-27 00:00:00+00',
	}
})

mock.module('@zeepkist/database/services', () => ({
	POINTS_HISTORY_KINDS: ['level_points_history', 'user_points_history'],
	prunePointsHistoryBatch,
}))

const { getPointsHistoryPruneWindow, prunePointsHistory } = await import('./prunePointsHistory')

beforeEach(() => {
	calls.length = 0
	counts.clear()
	failingHistory = undefined
	prunePointsHistoryBatch.mockClear()
})

test('uses a 28-day cutoff with UTC budget date', () => {
	expect(getPointsHistoryPruneWindow(new Date('2026-08-31T01:30:00.000Z'))).toEqual({
		budgetDate: '2026-08-31',
		pruneBefore: '2026-08-03T01:30:00.000Z',
	})
})

test('prunes both histories independently until persisted caps are reached', async () => {
	const info = mock(() => {})
	await prunePointsHistory({}, { logger: { error: mock(() => {}), info } } as never)

	expect(calls.map((call) => call.history)).toEqual([
		'level_points_history',
		'level_points_history',
		'user_points_history',
		'user_points_history',
	])
	expect(prunePointsHistoryBatch.mock.calls[0]?.[0]).toEqual(
		expect.objectContaining({
			batchDeleteLimit: 10_000,
			dailyDeleteLimit: 250_000,
			entityLimit: 200,
		}),
	)
	expect(info).toHaveBeenCalledWith(
		'Points history pruning table completed.',
		expect.objectContaining({
			advancedWeeks: 1,
			capReached: true,
			deletedRows: 10_000,
			history: 'level_points_history',
		}),
	)
})

test('continues second history after first fails, then rethrows for Graphile retry', async () => {
	failingHistory = 'level_points_history'
	const error = mock(() => {})

	await expect(
		prunePointsHistory({}, { logger: { error, info: mock(() => {}) } } as never),
	).rejects.toThrow('level_points_history failed')

	expect(calls.map((call) => call.history)).toEqual([
		'level_points_history',
		'user_points_history',
		'user_points_history',
	])
	expect(error).toHaveBeenCalledWith('Points history pruning table failed.', {
		error: expect.any(Error),
		history: 'level_points_history',
	})
})
