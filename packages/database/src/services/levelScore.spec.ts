import { beforeEach, expect, mock, test } from 'bun:test'
import { VOTE_RATING_MATURITY_MS } from '@zeepkist/core/score'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

let availability = new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]])
let personalBestRows: unknown[] = []
let matureVotes = new Map<number, number[]>()
const lockQueries: unknown[] = []

const scoreablePersonalBestRow = {
	idRecord: 10,
	idUser: 20,
	idLevel: 1,
	time: 60,
	splits: [20, 40],
	totalCount: 1,
	statisticTime: null,
	distance: null,
	hasInputData: null,
	hasStateData: null,
}

const transactionExecutor = {
	execute: mock(async (query: unknown) => {
		lockQueries.push(query)
		return []
	}),
}
const transaction = mock(
	async (callback: (executor: typeof transactionExecutor) => Promise<unknown>) =>
		callback(transactionExecutor),
)
const databaseExecutor = { transaction }

const getLevelWorkshopAvailabilities = mock(async () => availability)
const getLevelPointValuesByIds = mock(async () => [{ idLevel: 1, points: 100 }])
const getLevelSkillMetricsByLevelIds = mock(async () => new Map())
const getV2ScorePersonalBestsByLevelIds = mock(async () => personalBestRows)
const getVoteValuesByLevelIds = mock(
	async (_idLevels: number[], _eligibleBefore?: string) => matureVotes,
)
const setLevelPointsToZeroBulk = mock(async (ids: number[], _executor?: unknown) => ids)
const upsertLevelPointsBulk = mock(
	async (updates: Array<{ idLevel: number }>, _executor?: unknown) =>
		updates.map((update) => update.idLevel),
)
const syncUserPointContributionLevels = mock(async (ids: number[]) => ({
	idUsers: [20, 30],
	levels: ids.length,
	users: 10,
}))

mock.module('../client', () => ({ db: databaseExecutor }))
mock.module('./levelPoints', () => ({
	getLevelPointValuesByIds,
	setLevelPointsToZeroBulk,
	upsertLevelPointsBulk,
}))
mock.module('./playerSkill', () => ({ getLevelSkillMetricsByLevelIds }))
mock.module('./record', () => ({ getV2ScorePersonalBestsByLevelIds }))
mock.module('./userPointContribution', () => ({ syncUserPointContributionLevels }))
mock.module('./vote', () => ({ getVoteValuesByLevelIds }))
mock.module('./workshop', () => ({ getLevelWorkshopAvailabilities }))

const { updateLevelScoreBatch } = await import('./levelScore')

function createLogger() {
	return {
		info: mock((_message: string, _metadata?: Record<string, unknown>) => {}),
	}
}

beforeEach(() => {
	availability = new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = []
	matureVotes = new Map()
	lockQueries.length = 0
	transaction.mockClear()
	transactionExecutor.execute.mockClear()
	getLevelWorkshopAvailabilities.mockClear()
	getLevelPointValuesByIds.mockClear()
	getLevelPointValuesByIds.mockImplementation(async () => [{ idLevel: 1, points: 100 }])
	getLevelSkillMetricsByLevelIds.mockClear()
	getV2ScorePersonalBestsByLevelIds.mockClear()
	getVoteValuesByLevelIds.mockClear()
	setLevelPointsToZeroBulk.mockClear()
	upsertLevelPointsBulk.mockClear()
	upsertLevelPointsBulk.mockImplementation(
		async (updates: Array<{ idLevel: number }>, _executor?: unknown) =>
			updates.map((update) => update.idLevel),
	)
	syncUserPointContributionLevels.mockClear()
})

test('loads only votes unchanged for at least seven days', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	const before = Date.now()

	await updateLevelScoreBatch({ idLevels: [1] })

	const after = Date.now()
	const eligibleBefore = getVoteValuesByLevelIds.mock.calls[0]?.[1]
	const cutoff = Date.parse(eligibleBefore ?? '')

	expect(getVoteValuesByLevelIds).toHaveBeenCalledTimes(1)
	expect(cutoff).toBeGreaterThanOrEqual(before - VOTE_RATING_MATURITY_MS)
	expect(cutoff).toBeLessThanOrEqual(after - VOTE_RATING_MATURITY_MS)
})

test('persists only retained V2 score fields', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [scoreablePersonalBestRow]
	matureVotes = new Map([[1, [1, 2]]])

	await updateLevelScoreBatch({ idLevels: [1] })

	const updates = upsertLevelPointsBulk.mock.calls[0]?.[0] as Array<Record<string, unknown>>
	expect(updates).toHaveLength(1)
	expect(Object.keys(updates[0] ?? {}).toSorted()).toEqual([
		'complexityConfidence',
		'complexityScore',
		'evidenceModifier',
		'fieldStrength',
		'idLevel',
		'lengthModifier',
		'points',
		'qualityModifier',
		'qualityScore',
		'rating',
		'ratingModifier',
		'skillAlignment',
		'skillConfidence',
		'skillSampleSize',
		'skillScore',
		'skillSeparation',
	])
	expect(updates[0]).toMatchObject({
		complexityScore: 0.5,
		evidenceModifier: expect.any(Number),
		idLevel: 1,
		qualityModifier: expect.any(Number),
		rating: 0.5,
		ratingModifier: 0.8,
		skillScore: 0.5,
	})
})

test('boosts level points after five mature positive votes', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [scoreablePersonalBestRow]
	matureVotes = new Map([[1, [1, 1, 1, 1, 1]]])

	await updateLevelScoreBatch({ idLevels: [1] })

	const updates = upsertLevelPointsBulk.mock.calls[0]?.[0] as Array<Record<string, unknown>>
	expect(updates[0]).toMatchObject({ rating: 0.75, ratingModifier: 0.9 })
})

test('skips score evidence reads for unavailable levels', async () => {
	availability = new Map([[1, { adventure: false, itemCount: 1, accessibleItemCount: 0 }]])

	await updateLevelScoreBatch({ idLevels: [1] })

	expect(getV2ScorePersonalBestsByLevelIds).not.toHaveBeenCalled()
	expect(getLevelSkillMetricsByLevelIds).not.toHaveBeenCalled()
	expect(getVoteValuesByLevelIds).not.toHaveBeenCalled()
	expect(setLevelPointsToZeroBulk).toHaveBeenCalledWith([1], transactionExecutor)
})

test('locks sorted unique levels and uses one transaction executor throughout', async () => {
	availability = new Map([
		[2, { adventure: true, itemCount: 0, accessibleItemCount: 0 }],
		[7, { adventure: true, itemCount: 0, accessibleItemCount: 0 }],
	])

	await updateLevelScoreBatch({ idLevels: [7, 2, 7] })

	expect(transaction).toHaveBeenCalledTimes(1)
	expect(lockQueries).toHaveLength(1)
	const lockQuery = new PgDialect().sqlToQuery(lockQueries[0] as SQL)
	expect(lockQuery.sql).toContain('pg_advisory_xact_lock(0, lock_target.id_level)')
	expect(lockQuery.sql).toContain('ORDER BY lock_target.id_level')
	expect(lockQuery.params).toEqual([[2, 7]])
	expect(getLevelWorkshopAvailabilities).toHaveBeenCalledWith([2, 7], transactionExecutor)
	expect(getLevelPointValuesByIds).toHaveBeenCalledWith([2, 7], transactionExecutor)
	expect(upsertLevelPointsBulk.mock.calls[0]?.[1]).toBe(transactionExecutor)
	expect(setLevelPointsToZeroBulk.mock.calls[0]?.[1]).toBe(transactionExecutor)
	expect(syncUserPointContributionLevels).toHaveBeenCalledWith([2, 7], {
		transaction: transactionExecutor,
	})
})

test('syncs contribution projection when awarded points stay unchanged', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	getLevelPointValuesByIds.mockImplementationOnce(async () => [{ idLevel: 1, points: 0 }])
	const logger = createLogger()

	await updateLevelScoreBatch({ idLevels: [1], logger })

	expect(upsertLevelPointsBulk).toHaveBeenCalledTimes(1)
	expect(syncUserPointContributionLevels).toHaveBeenCalledWith([1], {
		transaction: transactionExecutor,
	})
	const timingCall = logger.info.mock.calls.find(([message]) =>
		message.startsWith('Level score batch timings:'),
	)
	expect(timingCall?.[0]).toMatch(
		/^Level score batch timings: contributionProjection=\d+ms total=\d+ms\.$/,
	)
	expect(timingCall?.[1]).toEqual(
		expect.objectContaining({
			contributionProjectionMs: expect.any(Number),
			totalMs: expect.any(Number),
		}),
	)
})

test('rolls back batch when persistence fails', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	upsertLevelPointsBulk.mockImplementationOnce(async () => {
		throw new Error('level persistence failed')
	})

	await expect(updateLevelScoreBatch({ idLevels: [1] })).rejects.toThrow(
		'level persistence failed',
	)
	expect(transaction).toHaveBeenCalledTimes(1)
	expect(syncUserPointContributionLevels).not.toHaveBeenCalled()
})

test('report-only mode logs proposed deltas without transaction or writes', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [scoreablePersonalBestRow]
	const logger = createLogger()

	const result = await updateLevelScoreBatch({ idLevels: [1], reportOnly: true, logger })

	expect(result).toEqual({ affectedUserIds: [], updated: 0, zeroed: 0, reported: 1 })
	expect(transaction).not.toHaveBeenCalled()
	expect(lockQueries).toHaveLength(0)
	expect(upsertLevelPointsBulk).not.toHaveBeenCalled()
	expect(setLevelPointsToZeroBulk).not.toHaveBeenCalled()
	expect(syncUserPointContributionLevels).not.toHaveBeenCalled()
	expect(logger.info).toHaveBeenCalledWith(
		'Calculated report-only level scores.',
		expect.objectContaining({ levels: expect.any(Array) }),
	)
})
