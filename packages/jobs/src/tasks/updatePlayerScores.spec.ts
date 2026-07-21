import { expect, mock, test } from 'bun:test'

const postgresCause = Object.assign(new Error('duplicate key'), {
	code: '23505',
	constraint: 'user_point_contribution_pkey',
	detail: 'Key already exists.',
	routine: '_bt_check_unique',
})
const persistenceError = Object.assign(new Error('Failed query'), { cause: postgresCause })
const upsertUserPointContributionsBulk = mock(async () => {
	throw persistenceError
})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPoints: () => ({ points: 100, totalPoints: 100, contributions: [] }),
}))
mock.module('@zeepkist/database/services', () => ({
	bulkUpdateUserRanks: mock(async () => {}),
	clearUserPointContributions: mock(async () => {}),
	getAllUsersWithLatestRecordDate: mock(async () => [
		{ idUser: 42, latestRecordDate: new Date().toISOString() },
	]),
	updateUserRanks: mock(async () => {}),
	upsertUserPointContributionsBulk,
	upsertUserPointsBulk: mock(async () => {}),
}))
mock.module('@zeepkist/database/services/personalBest', () => ({
	getPersonalBestLevelIdsForUsers: mock(async () => [7]),
}))
mock.module('../utils/playerScoreLeaderboardCache', () => ({
	getCachedLevelLeaderboards: mock(
		async () => new Map([[7, [{ idUser: 42, idLevel: 7, idRecord: 70, time: 60 }]]]),
	),
}))

const { updatePlayerScores } = await import('./updatePlayerScores')

test('logs PostgreSQL metadata and affected user batch before rethrow', async () => {
	const error = mock(() => {})
	const logger = { error, info: mock(() => {}) }

	await expect(updatePlayerScores({}, { logger } as never)).rejects.toBe(persistenceError)
	expect(error).toHaveBeenCalledWith('Player score batch persistence failed.', {
		idUsers: [42],
		postgres: {
			code: '23505',
			constraint: 'user_point_contribution_pkey',
			detail: 'Key already exists.',
			message: 'duplicate key',
			routine: '_bt_check_unique',
		},
	})
})
