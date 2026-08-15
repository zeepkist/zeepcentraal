import { beforeEach, expect, mock, test } from 'bun:test'

const sourceContribution = {
	contributionRank: 1,
	idLevel: 7,
	idRecord: 70,
	levelDecayedPoints: 100,
	levelPoints: 200,
	levelPosition: 1,
	playerDecayedPoints: 100,
}
const calculatePlayerPointsFromContributions = mock((contributions: unknown[]) => ({
	contributions,
	points: 100,
	totalPoints: 200,
}))
const getUserPointContributionsForUsers = mock(async () => new Map([[42, [sourceContribution]]]))
const persistUserPointScore = mock(async () => true)

mock.module('@zeepkist/core/score', () => ({ calculatePlayerPointsFromContributions }))
mock.module('@zeepkist/database', () => ({
	getUserPointContributionsForUsers,
	persistUserPointScore,
}))

const { PLAYER_SCORE_SNAPSHOT_ATTEMPTS, recalculateAndPersistPlayerScore } = await import(
	'./recalculatePlayerScore'
)

beforeEach(() => {
	calculatePlayerPointsFromContributions.mockClear()
	getUserPointContributionsForUsers.mockClear()
	persistUserPointScore.mockClear()
	persistUserPointScore.mockImplementation(async () => true)
})

test('persists an initial contribution snapshot without rereading', async () => {
	const result = await recalculateAndPersistPlayerScore({
		idUser: 42,
		initialContributions: [sourceContribution],
	})

	expect(result.points).toBe(100)
	expect(getUserPointContributionsForUsers).not.toHaveBeenCalled()
	expect(persistUserPointScore).toHaveBeenCalledWith({
		idUser: 42,
		contributions: [sourceContribution],
		points: 100,
		totalPoints: 200,
	})
})

test('rereads and recalculates after a snapshot mismatch', async () => {
	persistUserPointScore.mockImplementationOnce(async () => false)
	const onSnapshotMismatch = mock((_attempt: number) => {})

	await recalculateAndPersistPlayerScore({
		idUser: 42,
		initialContributions: [sourceContribution],
		onSnapshotMismatch,
	})

	expect(onSnapshotMismatch).toHaveBeenCalledWith(1)
	expect(getUserPointContributionsForUsers).toHaveBeenCalledWith([42])
	expect(persistUserPointScore).toHaveBeenCalledTimes(2)
})

test('fails after three changing snapshots', async () => {
	persistUserPointScore.mockImplementation(async () => false)

	await expect(
		recalculateAndPersistPlayerScore({
			idUser: 42,
			initialContributions: [sourceContribution],
		}),
	).rejects.toThrow('Player contribution snapshot changed 3 times for idUser=42.')
	expect(PLAYER_SCORE_SNAPSHOT_ATTEMPTS).toBe(3)
	expect(persistUserPointScore).toHaveBeenCalledTimes(3)
})
