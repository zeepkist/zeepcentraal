import { expect, test } from 'bun:test'
import { cronTasks } from './cronTasks'

test('all job schedules parse with configured Bun time zones', () => {
	for (const task of cronTasks) {
		const timeZone = 'timeZone' in task ? task.timeZone : 'Europe/London'
		const next = Bun.cron.parse(task.cronTime, Date.parse('2026-08-28T00:00:00Z'), {
			tz: timeZone,
		})
		expect(next).toBeInstanceOf(Date)
	}
})

test('Europe/London schedules preserve Bun spring and fall DST semantics', () => {
	expect(
		Bun.cron
			.parse('30 1 * * *', Date.parse('2026-03-29T00:00:00Z'), {
				tz: 'Europe/London',
			})
			?.toISOString(),
	).toBe('2026-03-29T01:30:00.000Z')
	expect(
		Bun.cron
			.parse('30 1 * * *', Date.parse('2026-10-24T23:00:00Z'), {
				tz: 'Europe/London',
			})
			?.toISOString(),
	).toBe('2026-10-25T00:30:00.000Z')
})

test('explicit UTC rotation remains fixed at 06:00 UTC', () => {
	expect(
		Bun.cron
			.parse('0 6 * * 1', Date.parse('2026-08-24T06:00:00Z'), { tz: 'UTC' })
			?.toISOString(),
	).toBe('2026-08-31T06:00:00.000Z')
})
