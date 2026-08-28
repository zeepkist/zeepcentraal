import { describe, expect, test } from 'bun:test'
import { Elysia, problem } from 'elysia'
import {
	createElysiaRequestLoggingPlugin,
	formatRequestLog,
	type RequestLogEntry,
} from './requestLogging'

describe('Elysia request logging', () => {
	test('formats the preserved request fields', () => {
		expect(
			formatRequestLog({
				timestamp: new Date('2026-08-28T12:34:56.789Z'),
				level: 'WARNING',
				method: 'POST',
				status: 429,
				pathname: '/record/submit',
				durationMs: 501.25,
				speed: 'SLOW',
				ip: '203.0.113.8',
			}),
		).toBe(
			'2026-08-28 12:34:56.789 WARNING\tPOST\t429 /record/submit 501.25ms SLOW 203.0.113.8',
		)
	})

	test('logs status, duration class, and trusted proxy IP', async () => {
		const entries: RequestLogEntry[] = []
		const app = new Elysia()
			.use(
				createElysiaRequestLoggingPlugin({
					trustProxy: true,
					slowThresholdMs: -1,
					verySlowThresholdMs: -1,
					sink: (entry) => entries.push(entry),
				}),
			)
			.get('/problem', () => problem(429, { detail: 'Too many requests' }))

		await app.handle(
			new Request('http://localhost/problem?secret=ignored', {
				headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' },
			}),
		)
		await new Promise((resolve) => queueMicrotask(resolve))

		expect(entries).toHaveLength(1)
		expect(entries[0]).toMatchObject({
			level: 'WARNING',
			method: 'GET',
			status: 429,
			pathname: '/problem',
			speed: 'VERY_SLOW',
			ip: '203.0.113.8',
		})
	})

	test('can be disabled', async () => {
		const entries: RequestLogEntry[] = []
		const app = new Elysia()
			.use(
				createElysiaRequestLoggingPlugin({
					enabled: false,
					sink: (entry) => entries.push(entry),
				}),
			)
			.get('/', () => 'OK')

		await app.handle(new Request('http://localhost/'))
		expect(entries).toEqual([])
	})
})
