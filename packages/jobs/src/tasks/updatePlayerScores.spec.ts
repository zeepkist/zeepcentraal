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
						contributionRank: 2_147_483_647,
						levelPosition: 27,
						levelPoints: 9368,
						levelDecayedPoints: 6323.9565,
						playerDecayedPoints: 0,
					},
				],
			]),
		),
)
const resetInactiveUserScores = mock(async () => {})
const upsertUserPointsBulk = mock(async () => {})
const getAllUsersWithLatestRecordDate = mock(async () => {
	events.push('user-discovery')
	return discoveredUsers
})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPointsFromContributions: (
		source: Array<{ idUser: number; levelDecayedPoints: number }>,
	) => {
		const contributions = source.map(({ idUser: _, ...contribution }, index) => ({
			...contribution,
			contributionRank: index + 1,
			playerDecayedPoints: contribution.levelDecayedPoints * 0.95 ** index,
		}))
		return {
			points: Math.round(
				contributions.reduce(
					(total, contribution) => total + contribution.playerDecayedPoints,
					0,
				),
			),
			totalPoints: Math.round(
				contributions.reduce(
					(total, contribution) => total + contribution.levelDecayedPoints,
					0,
				),
			),
			contributions,
		}
	},
}))
mock.module('@zeepkist/database/services', () => ({
	getAllUsersWithLatestRecordDate,
	getUserPointContributionsForUsers,
	resetInactiveUserScores,
	updateUserRanks: mock(async () => {}),
	updateUserPointContributionPlayerValuesBulk,
	upsertUserPointsBulk,
}))

const { updatePlayerScores } = await import('./updatePlayerScores')

beforeEach(() => {
	contributionError = persistenceError
	events.length = 0
	discoveredUsers = [{ idUser: 42, latestRecordDate: new Date().toISOString() }]
	resetInactiveUserScores.mockClear()
	getUserPointContributionsForUsers.mockClear()
	updateUserPointContributionPlayerValuesBulk.mockClear()
	upsertUserPointsBulk.mockClear()
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
	expect(upsertUserPointsBulk).toHaveBeenCalledWith([
		{ idUser: 42, points: 6324, totalPoints: 6324 },
	])
	expect(updateUserPointContributionPlayerValuesBulk).toHaveBeenCalledWith([
		{
			idUser: 42,
			contributions: [
				expect.objectContaining({
					contributionRank: 1,
					levelDecayedPoints: 6323.9565,
					playerDecayedPoints: 6323.9565,
				}),
			],
		},
	])
})

test('zeros inactive contribution points without recalculating them', async () => {
	contributionError = null
	discoveredUsers = [{ idUser: 42, latestRecordDate: '2020-01-01T00:00:00.000Z' }]

	await updatePlayerScores({}, {
		logger: { error: mock(() => {}), info: mock(() => {}) },
	} as never)

	expect(resetInactiveUserScores).toHaveBeenCalledWith([42])
	expect(getUserPointContributionsForUsers).not.toHaveBeenCalled()
	expect(updateUserPointContributionPlayerValuesBulk).not.toHaveBeenCalled()
	expect(upsertUserPointsBulk).not.toHaveBeenCalled()
})
