import { beforeEach, expect, mock, test } from 'bun:test'
import { cronTasks } from '../cronTasks'

const rotateDatabaseTrackTournament = mock(async () => ({ created: true }))

mock.module('@zeepkist/database', () => ({
	isTrackTournamentType: (value: number) => value === 0 || value === 1,
	rotateTrackTournament: rotateDatabaseTrackTournament,
}))

const { rotateTrackTournament } = await import('./rotateTrackTournament')

beforeEach(() => rotateDatabaseTrackTournament.mockClear())

test('rotates valid weekly and monthly tournament types', async () => {
	const info = mock(() => {})
	const warn = mock(() => {})
	for (const type of [0, 1]) {
		await rotateTrackTournament({ type }, { logger: { info, warn } } as never)
	}
	expect(rotateDatabaseTrackTournament).toHaveBeenCalledTimes(2)
})

test('rejects invalid tournament type', async () => {
	const warn = mock(() => {})
	await rotateTrackTournament({ type: 2 }, { logger: { warn } } as never)
	expect(rotateDatabaseTrackTournament).not.toHaveBeenCalled()
	expect(warn).toHaveBeenCalled()
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
