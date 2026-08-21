import { beforeEach, expect, mock, test } from 'bun:test'
import { cronTasks } from '../cronTasks'

type RotationResult =
	| { created: boolean; idTournament: number }
	| { created: false; reason: 'empty-pool' }
const rotateDatabaseTrackTournament = mock(
	async (): Promise<RotationResult> => ({ created: true, idTournament: 42 }),
)

mock.module('@zeepkist/database', () => ({
	isTrackTournamentType: (value: number) => value === 0 || value === 1,
	rotateTrackTournament: rotateDatabaseTrackTournament,
	TRACK_TOURNAMENT_TYPE: { weekly: 0, monthly: 1 },
}))

const { rotateTrackTournament } = await import('./rotateTrackTournament')

beforeEach(() => rotateDatabaseTrackTournament.mockClear())

test('rotates valid weekly and monthly tournament types and prepares weekly asset', async () => {
	const info = mock(() => {})
	const warn = mock(() => {})
	const addJob = mock(async () => {})
	for (const type of [0, 1]) {
		await rotateTrackTournament({ type }, { addJob, logger: { info, warn } } as never)
	}
	expect(rotateDatabaseTrackTournament).toHaveBeenCalledTimes(2)
	expect(addJob).toHaveBeenCalledTimes(1)
	expect(addJob).toHaveBeenCalledWith(
		'prepareTrackTournamentLobbyAsset',
		{ idTournament: 42 },
		{ jobKey: 'prepare-track-tournament-lobby-asset:42' },
	)
})

test('rejects invalid tournament type', async () => {
	const warn = mock(() => {})
	await rotateTrackTournament({ type: 2 }, { logger: { warn } } as never)
	expect(rotateDatabaseTrackTournament).not.toHaveBeenCalled()
	expect(warn).toHaveBeenCalled()
})

test('uses type-neutral logging when a tournament quality pool is empty', async () => {
	const warn = mock(() => {})
	rotateDatabaseTrackTournament.mockImplementationOnce(async () => ({
		created: false,
		reason: 'empty-pool',
	}))
	await rotateTrackTournament({ type: 1 }, { logger: { warn } } as never)
	expect(warn).toHaveBeenCalledWith(
		'rotateTrackTournament found no unused level in tournament quality pool.',
		{ type: 1 },
	)
})

test('uses distinct stable UTC weekly and monthly schedules', () => {
	const rotations = cronTasks.filter(({ task }) => task === 'rotateTrackTournament')
	expect(rotations).toEqual([
		{
			task: 'rotateTrackTournament',
			cronTime: '0 6 * * 1',
			payload: { type: 0 },
			timeZone: 'UTC',
			spec: { jobKey: 'cron:rotateTrackTournament:weekly' },
		},
		{
			task: 'rotateTrackTournament',
			cronTime: '0 6 1 * *',
			payload: { type: 1 },
			timeZone: 'UTC',
			spec: { jobKey: 'cron:rotateTrackTournament:monthly' },
		},
	])
})
