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
let discoveredUsers = [{ idUser: 42, latestRecordDate: new Date().toISOString() }]
const updateUserPointContributionPlayerValuesBulk = mock(async () => {
	if (contributionError) throw contributionError
})
const getUserPointContributionsForUsers = mock(
	async (idUsers: number[]) =>
		new Map(
			idUsers.map((idUser) => [
				idUser,
				[
					{
						idUser,
						idLevel: 7,
						idRecord: 70,
						contributionRank: 1,
						levelPosition: 1,
						levelPoints: 100,
						levelDecayedPoints: 100,
						playerDecayedPoints: 100,
					},
				],
			]),
		),
)
const bulkUpdateUserRanks = mock(async () => {})
const getAllUsersWithLatestRecordDate = mock(async () => {
	events.push('user-discovery')
	return discoveredUsers
})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPointsFromContributions: (source: Array<{ idUser: number }>) => ({
		points: 100,
		totalPoints: 100,
		contributions: source.map(({ idUser: _, ...contribution }) => contribution),
	}),
}))
mock.module('@zeepkist/database/services', () => ({
	bulkUpdateUserRanks,
	getAllUsersWithLatestRecordDate,
	getUserPointContributionsForUsers,
	updateUserRanks: mock(async () => {}),
	updateUserPointContributionPlayerValuesBulk,
	upsertUserPointsBulk: mock(async () => {}),
}))

const { updatePlayerScores } = await import('./updatePlayerScores')

beforeEach(() => {
	contributionError = persistenceError
	events.length = 0
	discoveredUsers = [{ idUser: 42, latestRecordDate: new Date().toISOString() }]
	bulkUpdateUserRanks.mockClear()
	getUserPointContributionsForUsers.mockClear()
	updateUserPointContributionPlayerValuesBulk.mockClear()
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

test('retains and recalculates inactive contribution rows while resetting rank', async () => {
	contributionError = null
	discoveredUsers = [{ idUser: 42, latestRecordDate: '2020-01-01T00:00:00.000Z' }]

	await updatePlayerScores({}, {
		logger: { error: mock(() => {}), info: mock(() => {}) },
	} as never)

	expect(bulkUpdateUserRanks).toHaveBeenCalledWith({
		idUsers: [42],
		points: 0,
		rank: -1,
	})
	expect(getUserPointContributionsForUsers).toHaveBeenCalledWith([42])
	expect(updateUserPointContributionPlayerValuesBulk).toHaveBeenCalledWith([
		{
			idUser: 42,
			contributions: [expect.objectContaining({ idLevel: 7, idRecord: 70 })],
		},
	])
})
