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
const recalculateAndPersistPlayerScore = mock(async ({ idUser }: { idUser: number }) => {
	if (contributionError) throw contributionError
	return { idUser, points: 6324, totalPoints: 6324, contributions: [] }
})
const getUserPointContributionsForUsers = mock(
	async (idUsers: number[]) =>
		new Map(
			idUsers.map((idUser) => [
				idUser,
				[
					{
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
const rankActiveUsersByPoints = mock(async () => 1)
const getUsersWithLatestRecordDatePage = mock(
	async ({ afterId, limit }: { afterId: number; limit: number }) => {
		events.push('user-discovery')
		return discoveredUsers.filter((user) => user.idUser > afterId).slice(0, limit)
	},
)

mock.module('@zeepkist/database/services', () => ({
	getUserPointContributionsForUsers,
	getUsersWithLatestRecordDatePage,
	rankActiveUsersByPoints,
	resetInactiveUserScores,
}))
mock.module('../utils/recalculatePlayerScore', () => ({ recalculateAndPersistPlayerScore }))

const { updatePlayerScores } = await import('./updatePlayerScores')

beforeEach(() => {
	contributionError = persistenceError
	events.length = 0
	discoveredUsers = [{ idUser: 42, latestRecordDate: new Date().toISOString() }]
	getUsersWithLatestRecordDatePage.mockClear()
	resetInactiveUserScores.mockClear()
	getUserPointContributionsForUsers.mockClear()
	recalculateAndPersistPlayerScore.mockClear()
	rankActiveUsersByPoints.mockClear()
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
			messages: ['Failed query', 'duplicate key'],
			routine: '_bt_check_unique',
			wrapperMessage: 'Failed query',
		},
	})
	expect(error).toHaveBeenCalledWith('updatePlayerScores failed.', {
		totalMs: expect.any(Number),
		postgres: {
			code: '23505',
			constraint: 'user_point_contribution_pkey',
			detail: 'Key already exists.',
			message: 'duplicate key',
			messages: ['Failed query', 'duplicate key'],
			routine: '_bt_check_unique',
			wrapperMessage: 'Failed query',
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
	const batchCompletion = info.mock.calls.find(
		([message]) =>
			typeof message === 'string' &&
			message.startsWith('Updated player score page 1, batch 1/1'),
	)
	expect(batchCompletion?.[0]).toMatch(/^Updated player score page 1, batch 1\/1 \(\d+ms\)\.$/)
	expect(batchCompletion?.[1]).toEqual(expect.objectContaining({ batchMs: expect.any(Number) }))
	expect(recalculateAndPersistPlayerScore).toHaveBeenCalledWith({
		idUser: 42,
		initialContributions: [
			expect.objectContaining({ idLevel: 7, levelDecayedPoints: 6323.9565 }),
		],
		onSnapshotMismatch: expect.any(Function),
	})
	expect(rankActiveUsersByPoints).toHaveBeenCalledWith([42])
})

test('zeros inactive contribution points without recalculating them', async () => {
	contributionError = null
	discoveredUsers = [{ idUser: 42, latestRecordDate: '2020-01-01T00:00:00.000Z' }]

	await updatePlayerScores({}, {
		logger: { error: mock(() => {}), info: mock(() => {}) },
	} as never)

	expect(resetInactiveUserScores).toHaveBeenCalledWith([42])
	expect(getUserPointContributionsForUsers).not.toHaveBeenCalled()
	expect(recalculateAndPersistPlayerScore).not.toHaveBeenCalled()
})

test('keyset-pages users by 200 with four bounded score workers', async () => {
	contributionError = null
	discoveredUsers = Array.from({ length: 201 }, (_, index) => ({
		idUser: index + 1,
		latestRecordDate: new Date().toISOString(),
	}))

	await updatePlayerScores({}, {
		logger: { error: mock(() => {}), info: mock(() => {}) },
	} as never)

	expect(getUsersWithLatestRecordDatePage.mock.calls.map(([input]) => input.afterId)).toEqual([
		0, 200,
	])
	expect(getUserPointContributionsForUsers.mock.calls.every(([ids]) => ids.length <= 50)).toBe(
		true,
	)
	expect(rankActiveUsersByPoints).toHaveBeenCalledWith(
		Array.from({ length: 201 }, (_, index) => index + 1),
	)
})
