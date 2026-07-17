import { expect, mock, test } from 'bun:test'
import { VOTE_RATING_MATURITY_MS } from '@zeepkist/core/score'

const getLevelWorkshopAvailabilities = mock(
	async () => new Map([[1, { adventure: false, itemCount: 0, accessibleItemCount: 0 }]]),
)
const getPersonalBestsWithRecordByLevelIds = mock(async () => [])
const getVoteValuesByLevelIds = mock(
	async (_idLevels: number[], _eligibleBefore?: string) => new Map<number, number[]>(),
)
const setLevelPointsToZeroBulk = mock(async () => {})
const upsertLevelPointsBulk = mock(async () => {})
const refreshCachedLevelLeaderboards = mock(async () => {})

mock.module('@zeepkist/database', () => ({
	getLevelWorkshopAvailabilities,
	getPersonalBestsWithRecordByLevelIds,
	getVoteValuesByLevelIds,
	setLevelPointsToZeroBulk,
	upsertLevelPointsBulk,
}))

mock.module('../utils/playerScoreLeaderboardCache', () => ({
	refreshCachedLevelLeaderboards,
}))

const { updateLevelScoreBatch } = await import('./levelScoreBatch')

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
