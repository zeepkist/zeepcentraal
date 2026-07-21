import { expect, mock, test } from 'bun:test'

const getUserPersonalBestsWithLevelPointsAndPosition = mock(async () => [{ idLevel: 1 }])
const upsertUserPointContributionsBulk = mock(async () => {})
const upsertUserPoints = mock(async () => {})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPoints: () => ({ contributions: [], points: 100, totalPoints: 100 }),
}))
mock.module('@zeepkist/database', () => ({
	clearUserPointContributions: mock(async () => {}),
	getUserPersonalBestsWithLevelPointsAndPosition,
	upsertUserPointContributionsBulk,
	upsertUserPoints,
}))

const { updatePlayerScore } = await import('./updatePlayerScore')

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
