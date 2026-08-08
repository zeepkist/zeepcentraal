import { expect, test } from 'bun:test'
import { createCommandRuntime } from './context'
import { CommandSessionStore } from './utils/session-store'

test('command runtime accepts deterministic dependencies', () => {
	const sessions = new CommandSessionStore()
	const runtime = createCommandRuntime({
		monotonicNow: () => 5,
		now: () => new Date('2026-08-06T00:00:00Z'),
		random: () => 0.5,
		sessions,
	})
	expect(runtime.monotonicNow()).toBe(5)
	expect(runtime.now().toISOString()).toBe('2026-08-06T00:00:00.000Z')
	expect(runtime.random()).toBe(0.5)
	expect(runtime.sessions).toBe(sessions)
})

test('command runtime supplies production defaults', () => {
	const runtime = createCommandRuntime()
	expect(runtime.now()).toBeInstanceOf(Date)
	expect(runtime.monotonicNow()).toBeNumber()
	expect(runtime.random()).toBeNumber()
	const result = runtime.sessions.createPages(
		'owner',
		10,
		{
			pageInfo: { hasNextPage: false, hasPreviousPage: false },
			rows: ['Body'],
			totalCount: 1,
		},
		{ title: 'Page' },
		async () => ({
			pageInfo: { hasNextPage: false, hasPreviousPage: false },
			rows: ['Body'],
			totalCount: 1,
		}),
	)
	expect(result.id).toBeString()
})
