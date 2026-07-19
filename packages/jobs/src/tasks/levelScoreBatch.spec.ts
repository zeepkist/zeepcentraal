import { beforeEach, expect, mock, test } from 'bun:test'
import { VOTE_RATING_MATURITY_MS } from '@zeepkist/core/score'

let availability = new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]])
let personalBestRows: unknown[] = []
let matureVotes = new Map<number, number[]>()

const getLevelWorkshopAvailabilities = mock(async () => availability)
const getLevelPointsByIds = mock(async () => [{ idLevel: 1, points: 100 }])
const getPersonalBestsWithRecordByLevelIds = mock(async () => personalBestRows)
const getVoteValuesByLevelIds = mock(
	async (_idLevels: number[], _eligibleBefore?: string) => matureVotes,
)
const setLevelPointsToZeroBulk = mock(async (_ids: number[]) => {})
const upsertLevelPointsBulk = mock(async (_updates: unknown[]) => {})
const refreshCachedLevelLeaderboards = mock(async () => {})

mock.module('@zeepkist/database', () => ({
	getLevelWorkshopAvailabilities,
	getLevelPointsByIds,
	getPersonalBestsWithRecordByLevelIds,
	getVoteValuesByLevelIds,
	setLevelPointsToZeroBulk,
	upsertLevelPointsBulk,
}))

mock.module('../utils/playerScoreLeaderboardCache', () => ({
	refreshCachedLevelLeaderboards,
}))

const { updateLevelScoreBatch } = await import('./levelScoreBatch')

beforeEach(() => {
	availability = new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = []
	matureVotes = new Map()
	getLevelWorkshopAvailabilities.mockClear()
	getLevelPointsByIds.mockClear()
	getPersonalBestsWithRecordByLevelIds.mockClear()
	getVoteValuesByLevelIds.mockClear()
	setLevelPointsToZeroBulk.mockClear()
	upsertLevelPointsBulk.mockClear()
	refreshCachedLevelLeaderboards.mockClear()
})

test('loads only votes unchanged for at least seven days', async () => {
	const before = Date.now()

	await updateLevelScoreBatch({
		idLevels: [1],
		personalBestCountPercentile: 0,
		logger: {} as never,
	})

	const after = Date.now()
	const eligibleBefore = getVoteValuesByLevelIds.mock.calls[0]?.[1]
	const cutoff = Date.parse(eligibleBefore ?? '')

	expect(getVoteValuesByLevelIds).toHaveBeenCalledTimes(1)
	expect(cutoff).toBeGreaterThanOrEqual(before - VOTE_RATING_MATURITY_MS)
	expect(cutoff).toBeLessThanOrEqual(after - VOTE_RATING_MATURITY_MS)
})

test('persists explainable score and telemetry metrics', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [
		{
			idRecord: 10,
			idUser: 20,
			idLevel: 1,
			time: 60,
			dateCreated: '2026-01-01T00:00:00.000Z',
			splits: [20, 40],
			speeds: [80, 100],
			totalCount: 1,
			statisticTime: null,
			distance: null,
			hasInputData: null,
			hasStateData: null,
		},
	]
	matureVotes = new Map([[1, [1, 2]]])

	await updateLevelScoreBatch({
		idLevels: [1],
		personalBestCountPercentile: 100,
		logger: {} as never,
	})

	const updates = upsertLevelPointsBulk.mock.calls[0]?.[0] as Array<Record<string, unknown>>
	expect(updates).toHaveLength(1)
	expect(updates[0]).toMatchObject({
		idLevel: 1,
		sampleSize: 1,
		inputSampleSize: 0,
		inputCoverage: 0,
		airSampleSize: 0,
		wheelSampleSize: 0,
		slipSampleSize: 0,
		ragdollSampleSize: 0,
		matureVoteCount: 2,
		modifierAfk: 0.9,
		passivePlaySeverity: null,
		worldRecordExcluded: false,
	})
	expect(updates[0]?.competitivenessModifier).toBeNumber()
	expect(updates[0]).not.toHaveProperty('scoreVersion')
})

test('report-only mode logs proposed deltas without writing scores', async () => {
	availability = new Map([[1, { adventure: true, itemCount: 0, accessibleItemCount: 0 }]])
	personalBestRows = [
		{
			idRecord: 10,
			idUser: 20,
			idLevel: 1,
			time: 60,
			dateCreated: '2026-01-01T00:00:00.000Z',
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
		personalBestCountPercentile: 100,
		reportOnly: true,
		logger: { info } as never,
	})

	expect(result).toEqual({ updated: 0, zeroed: 0, reported: 1 })
	expect(getLevelPointsByIds).toHaveBeenCalledWith([1])
	expect(upsertLevelPointsBulk).not.toHaveBeenCalled()
	expect(setLevelPointsToZeroBulk).not.toHaveBeenCalled()
	expect(refreshCachedLevelLeaderboards).not.toHaveBeenCalled()
	expect(info).toHaveBeenCalledWith(
		'Calculated report-only level scores.',
		expect.objectContaining({ levels: expect.any(Array) }),
	)
})
