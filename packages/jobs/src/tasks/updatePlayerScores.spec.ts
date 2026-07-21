import { beforeEach, expect, mock, test } from 'bun:test'

const postgresCause = Object.assign(new Error('duplicate key'), {
	code: '23505',
	constraint: 'user_point_contribution_pkey',
	detail: 'Key already exists.',
	routine: '_bt_check_unique',
})
const persistenceError = Object.assign(new Error('Failed query'), { cause: postgresCause })
let contributionError: unknown = persistenceError
const events: string[] = []
const upsertUserPointContributionsBulk = mock(async () => {
	if (contributionError) throw contributionError
})
const getAllUsersWithLatestRecordDate = mock(async () => {
	events.push('user-discovery')
	return [{ idUser: 42, latestRecordDate: new Date().toISOString() }]
})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPoints: () => ({ points: 100, totalPoints: 100, contributions: [] }),
}))
mock.module('@zeepkist/database/services', () => ({
	bulkUpdateUserRanks: mock(async () => {}),
	clearUserPointContributions: mock(async () => {}),
	getAllUsersWithLatestRecordDate,
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

beforeEach(() => {
	contributionError = persistenceError
	events.length = 0
	upsertUserPointContributionsBulk.mockClear()
})

test('logs PostgreSQL metadata and affected user batch before rethrow', async () => {
	const error = mock(() => {})
	const logger = {
		error,
		info: mock((message: unknown) => events.push(`log:${String(message)}`)),
	}

	await expect(updatePlayerScores({}, { logger } as never)).rejects.toBe(persistenceError)
	expect(logger.info.mock.calls[0]?.[0]).toBe('updatePlayerScores started.')
	expect(events.slice(0, 2)).toEqual(['log:updatePlayerScores started.', 'user-discovery'])
	expect(error).toHaveBeenCalledWith('Player score batch persistence failed.', {
		idUsers: [42],
		persistenceMs: expect.any(Number),
		postgres: {
			code: '23505',
			constraint: 'user_point_contribution_pkey',
			detail: 'Key already exists.',
			message: 'duplicate key',
			routine: '_bt_check_unique',
		},
	})
	expect(error).toHaveBeenCalledWith('updatePlayerScores failed.', {
		totalMs: expect.any(Number),
		postgres: {
			code: '23505',
			constraint: 'user_point_contribution_pkey',
			detail: 'Key already exists.',
			message: 'duplicate key',
			routine: '_bt_check_unique',
		},
	})
})

test('logs phase completion for successful full recalculation', async () => {
	contributionError = null
	const info = mock((..._args: unknown[]) => {})

	await updatePlayerScores({}, { logger: { error: mock(() => {}), info } } as never)

	expect(info.mock.calls[0]?.[0]).toBe('updatePlayerScores started.')
	expect(info).toHaveBeenCalledWith(
		'Discovered users for player-score recalculation.',
		expect.objectContaining({ discoveryMs: expect.any(Number), rankedUsers: 1 }),
	)
	expect(info).toHaveBeenCalledWith(
		'updatePlayerScores completed.',
		expect.objectContaining({ rankUpdateMs: expect.any(Number), totalMs: expect.any(Number) }),
	)
})
