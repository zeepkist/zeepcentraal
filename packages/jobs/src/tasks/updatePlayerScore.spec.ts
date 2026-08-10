import { beforeEach, expect, mock, test } from 'bun:test'

interface ProjectedContribution {
	contributionRank: number
	idLevel: number
	idRecord: number
	levelDecayedPoints: number
	levelPoints: number
	levelPosition: number
	playerDecayedPoints: number
}

function newlyProjectedContributions(): Map<number, ProjectedContribution[]> {
	return new Map([
		[
			42,
			[
				{
					contributionRank: 2_147_483_647,
					idLevel: 1,
					idRecord: 10,
					levelDecayedPoints: 6323.9565,
					levelPoints: 9368,
					levelPosition: 27,
					playerDecayedPoints: 0,
				},
			],
		],
	])
}

let projectedContributions = newlyProjectedContributions()
const getUserPointContributionsForUsers = mock(async () => projectedContributions)
const updateUserPointContributionPlayerValuesBulk = mock(async () => {})
const upsertUserPoints = mock(async () => {})
const calculatePlayerPointsFromContributions = mock((source: ProjectedContribution[]) => {
	const contributions = source.map((contribution, index) => ({
		...contribution,
		contributionRank: index + 1,
		playerDecayedPoints: contribution.levelDecayedPoints * 0.95 ** index,
	}))
	return {
		contributions,
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
	}
})

mock.module('@zeepkist/core/score', () => ({
	calculatePlayerPointsFromContributions,
}))
mock.module('@zeepkist/database', () => ({
	getUserPointContributionsForUsers,
	updateUserPointContributionPlayerValuesBulk,
	upsertUserPoints,
}))

const { updatePlayerScore } = await import('./updatePlayerScore')

beforeEach(() => {
	projectedContributions = newlyProjectedContributions()
	calculatePlayerPointsFromContributions.mockClear()
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

test('persists normalized player fields for newly projected contributions', async () => {
	await updatePlayerScore({ idUser: 42 }, {
		logger: { error: mock(() => {}), info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(calculatePlayerPointsFromContributions).toHaveBeenCalledWith(
		expect.arrayContaining([
			expect.objectContaining({
				contributionRank: 2_147_483_647,
				levelDecayedPoints: 6323.9565,
				playerDecayedPoints: 0,
			}),
		]),
	)
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
	expect(upsertUserPoints).toHaveBeenCalledWith({ idUser: 42, points: 6324, totalPoints: 6324 })
})

test('persists zero score when projection has no positive-point contributions', async () => {
	projectedContributions = new Map()

	await updatePlayerScore({ idUser: 42 }, {
		logger: { error: mock(() => {}), info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(upsertUserPoints).toHaveBeenCalledWith({ idUser: 42, points: 0, totalPoints: 0 })
})
