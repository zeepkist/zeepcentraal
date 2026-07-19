import { expect, test } from 'bun:test'
import { runPostGraphileReadyCheck } from './readinessCli'

test('ready-check executable mode targets loopback readiness route', async () => {
	let receivedUrl: string | undefined
	const exitCode = await runPostGraphileReadyCheck({
		port: 5000,
		timeoutMs: 100,
		fetchImpl: async (input) => {
			receivedUrl = String(input)
			return new Response('OK')
		},
	})

	expect(exitCode).toBe(0)
	expect(receivedUrl).toBe('http://127.0.0.1:5000/readyz')
})

test('ready-check executable mode fails on unavailable response or transport error', async () => {
	const unavailable = await runPostGraphileReadyCheck({
		port: 5000,
		timeoutMs: 100,
		fetchImpl: async () => new Response('Not Ready', { status: 503 }),
	})
	const transportFailure = await runPostGraphileReadyCheck({
		port: 5000,
		timeoutMs: 100,
		fetchImpl: async () => {
			throw new Error('connection refused')
		},
	})

	expect(unavailable).toBe(1)
	expect(transportFailure).toBe(1)
})
