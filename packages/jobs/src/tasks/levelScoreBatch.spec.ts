import { beforeEach, expect, mock, test } from 'bun:test'
import { VOTE_RATING_MATURITY_MS } from '@zeepkist/core/score'

let availability = new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]])
let personalBestRows: unknown[] = []
let matureVotes = new Map<number, number[]>()

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

const getLevelWorkshopAvailabilities = mock(async () => availability)
const getLevelPointValuesByIds = mock(async () => [{ idLevel: 1, points: 100 }])
const getLevelSkillMetricsByLevelIds = mock(async () => new Map())
const getV2ScorePersonalBestsByLevelIds = mock(async () => personalBestRows)
const getVoteValuesByLevelIds = mock(
	async (_idLevels: number[], _eligibleBefore?: string) => matureVotes,
)
const setLevelPointsToZeroBulk = mock(async (ids: number[]) => ids)
const upsertLevelPointsBulk = mock(async (updates: Array<{ idLevel: number }>) =>
	updates.map((update) => update.idLevel),
)
const syncUserPointContributionLevels = mock(async (ids: number[]) => ({
	levels: ids.length,
	users: 10,
}))

mock.module('@zeepkist/database', () => ({
	getLevelWorkshopAvailabilities,
	getLevelPointValuesByIds,
	getLevelSkillMetricsByLevelIds,
	getV2ScorePersonalBestsByLevelIds,
	getVoteValuesByLevelIds,
	setLevelPointsToZeroBulk,
	syncUserPointContributionLevels,
	upsertLevelPointsBulk,
}))

const { updateLevelScoreBatch } = await import('./levelScoreBatch')

beforeEach(() => {
	availability = new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = []
	matureVotes = new Map()
	getLevelWorkshopAvailabilities.mockClear()
	getLevelPointValuesByIds.mockClear()
	getLevelSkillMetricsByLevelIds.mockClear()
	getV2ScorePersonalBestsByLevelIds.mockClear()
	getVoteValuesByLevelIds.mockClear()
	setLevelPointsToZeroBulk.mockClear()
	upsertLevelPointsBulk.mockClear()
	syncUserPointContributionLevels.mockClear()
})

test('loads only votes unchanged for at least seven days', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	const before = Date.now()

	await updateLevelScoreBatch({
		idLevels: [1],
		logger: { info: mock(() => {}) } as never,
	})

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

	await updateLevelScoreBatch({
		idLevels: [1],
		logger: { info: mock(() => {}) } as never,
	})

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
		ratingModifier: 1,
		skillScore: 0.5,
	})
})

test('boosts level points after five mature positive votes', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [scoreablePersonalBestRow]
	matureVotes = new Map([[1, [1, 1, 1, 1, 1]]])

	await updateLevelScoreBatch({
		idLevels: [1],
		logger: { info: mock(() => {}) } as never,
	})

	const updates = upsertLevelPointsBulk.mock.calls[0]?.[0] as Array<Record<string, unknown>>
	expect(updates[0]).toMatchObject({ rating: 0.75, ratingModifier: 1.125 })
})

test('skips score evidence reads for unavailable levels', async () => {
	availability = new Map([[1, { adventure: false, itemCount: 1, accessibleItemCount: 0 }]])

	await updateLevelScoreBatch({
		idLevels: [1],
		logger: { info: mock(() => {}) } as never,
	})

	expect(getV2ScorePersonalBestsByLevelIds).not.toHaveBeenCalled()
	expect(getLevelSkillMetricsByLevelIds).not.toHaveBeenCalled()
	expect(getVoteValuesByLevelIds).not.toHaveBeenCalled()
	expect(setLevelPointsToZeroBulk).toHaveBeenCalledWith([1])
})

test('syncs contribution projection when awarded points stay unchanged', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	getLevelPointValuesByIds.mockImplementationOnce(async () => [{ idLevel: 1, points: 0 }])

	await updateLevelScoreBatch({
		idLevels: [1],
		logger: { info: mock(() => {}) } as never,
	})

	expect(upsertLevelPointsBulk).toHaveBeenCalledTimes(1)
	expect(syncUserPointContributionLevels).toHaveBeenCalledWith([1])
})

test('defers contribution projection for bulk score batches', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	const info = mock((_message: string, _metadata?: unknown) => {})

	await updateLevelScoreBatch({
		idLevels: [1],
		syncContributions: false,
		logger: { info } as never,
	})

	expect(syncUserPointContributionLevels).not.toHaveBeenCalled()
	expect(info.mock.calls.at(-1)?.[0]).toStartWith('Level score batch timings:')
	expect(info.mock.calls.at(-1)?.[1]).toMatchObject({ contributionProjectionMs: 0 })
})

test('report-only mode logs proposed deltas without writing scores', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [
		{
			idRecord: 10,
			idUser: 20,
			idLevel: 1,
			time: 60,
			totalCount: 1,
			statisticTime: null,
			distance: null,
			hasInputData: null,
			hasStateData: null,
		},
	]
	const info = mock(() => {})

	const result = await updateLevelScoreBatch({
		idLevels: [1],
		reportOnly: true,
		logger: { info } as never,
	})

	expect(result).toEqual({ updated: 0, zeroed: 0, reported: 1 })
	expect(getLevelPointValuesByIds).toHaveBeenCalledWith([1])
	expect(upsertLevelPointsBulk).not.toHaveBeenCalled()
	expect(setLevelPointsToZeroBulk).not.toHaveBeenCalled()
	expect(syncUserPointContributionLevels).not.toHaveBeenCalled()
	expect(info).toHaveBeenCalledWith(
		'Calculated report-only level scores.',
		expect.objectContaining({ levels: expect.any(Array) }),
	)
})
