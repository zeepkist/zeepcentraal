import { beforeEach, expect, mock, test } from 'bun:test'

let projectedContributions = new Map([[42, [{ idLevel: 1 }]]])
const getUserPointContributionsForUsers = mock(async () => projectedContributions)
const updateUserPointContributionPlayerValuesBulk = mock(async () => {})
const upsertUserPoints = mock(async () => {})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPointsFromContributions: () => ({
		contributions: [],
		points: projectedContributions.size === 0 ? 0 : 100,
		totalPoints: projectedContributions.size === 0 ? 0 : 100,
	}),
}))
mock.module('@zeepkist/database', () => ({
	getUserPointContributionsForUsers,
	updateUserPointContributionPlayerValuesBulk,
	upsertUserPoints,
}))

const { updatePlayerScore } = await import('./updatePlayerScore')

beforeEach(() => {
	projectedContributions = new Map([[42, [{ idLevel: 1 }]]])
	getUserPointContributionsForUsers.mockClear()
	updateUserPointContributionPlayerValuesBulk.mockClear()
	upsertUserPoints.mockClear()
})

test('logs start and completion timings', async () => {
	const info = mock((..._args: unknown[]) => {})

	await updatePlayerScore({ idUser: 42 }, {
		logger: { error: mock(() => {}), info, warn: mock(() => {}) },
	} as never)

	expect(info.mock.calls[0]?.[0]).toBe('updatePlayerScore started for idUser=42.')
	expect(info).toHaveBeenCalledWith('updatePlayerScore completed for idUser=42.', {
		totalMs: expect.any(Number),
	})
})

test('persists zero score when projection has no positive-point contributions', async () => {
	projectedContributions = new Map()

	await updatePlayerScore({ idUser: 42 }, {
		logger: { error: mock(() => {}), info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(upsertUserPoints).toHaveBeenCalledWith({ idUser: 42, points: 0, totalPoints: 0 })
})
