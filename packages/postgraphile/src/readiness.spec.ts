import { describe, expect, test } from 'bun:test'
import { createReadinessService, type ReadinessAttempt, type ReadinessProbe } from './readiness'

function controlledProbe() {
	let starts = 0
	let cancellations = 0
	let closes = 0
	let current = Promise.withResolvers<void>()

	const probe: ReadinessProbe = {
		start(): ReadinessAttempt {
			starts += 1
			return {
				promise: current.promise,
				cancel() {
					cancellations += 1
				},
			}
		},
		async close() {
			closes += 1
		},
	}

	return {
		probe,
		resolve() {
			current.resolve()
		},
		reject() {
			current.reject(new Error('database unavailable'))
		},
		reset() {
			current = Promise.withResolvers<void>()
		},
		counts() {
			return { starts, cancellations, closes }
		},
	}
}

const noMetrics = { record() {} }

describe('createReadinessService', () => {
	test('deduplicates concurrent probes and caches completed result', async () => {
		const controlled = controlledProbe()
		const readiness = createReadinessService(
			controlled.probe,
			{ timeoutMs: 100, cacheMs: 1000 },
			noMetrics,
		)

		const first = readiness.check()
		const second = readiness.check()
		expect(controlled.counts().starts).toBe(1)

		controlled.resolve()
		expect(await first).toEqual({ ok: true })
		expect(await second).toEqual({ ok: true })
		expect(await readiness.check()).toEqual({ ok: true })
		expect(controlled.counts().starts).toBe(1)

		await readiness.dispose()
		expect(controlled.counts().closes).toBe(1)
	})

	test('returns not ready and caches probe failures', async () => {
		const controlled = controlledProbe()
		const readiness = createReadinessService(
			controlled.probe,
			{ timeoutMs: 100, cacheMs: 1000 },
			noMetrics,
		)

		const first = readiness.check()
		controlled.reject()
		expect(await first).toEqual({ ok: false })
		expect(await readiness.check()).toEqual({ ok: false })
		expect(controlled.counts().starts).toBe(1)

		await readiness.dispose()
	})

	test('bounds probe duration and cancels timed-out query', async () => {
		const controlled = controlledProbe()
		const outcomes: string[] = []
		const readiness = createReadinessService(
			controlled.probe,
			{ timeoutMs: 5, cacheMs: 0 },
			{ record: (_duration, outcome) => outcomes.push(outcome) },
		)

		expect(await readiness.check()).toEqual({ ok: false })
		expect(controlled.counts().cancellations).toBe(1)
		expect(outcomes).toEqual(['timeout'])
		expect(await readiness.check()).toEqual({ ok: false })
		expect(controlled.counts().starts).toBe(1)

		controlled.resolve()
		await readiness.dispose()
	})

	test('rejects readiness checks after disposal', async () => {
		const controlled = controlledProbe()
		controlled.resolve()
		const readiness = createReadinessService(
			controlled.probe,
			{ timeoutMs: 100, cacheMs: 0 },
			noMetrics,
		)

		await readiness.dispose()
		expect(await readiness.check()).toEqual({ ok: false })
		expect(controlled.counts().starts).toBe(0)
	})
})
