import { getMeter } from '@zeepkist/telemetry'

export type ReadinessResult = {
	ok: boolean
}

export type ReadinessAttempt = {
	promise: Promise<void>
	cancel(): void
}

export type ReadinessProbe = {
	start(): ReadinessAttempt
	close(): Promise<void>
}

export type ReadinessService = {
	check(): Promise<ReadinessResult>
	dispose(): Promise<void>
}

type ReadinessServiceConfig = {
	cacheMs: number
	timeoutMs: number
}

type ReadinessMetrics = {
	record(durationMs: number, outcome: 'ready' | 'error' | 'timeout'): void
}

const meter = getMeter('zeepcentraal-postgraphile')
const readinessAttempts = meter.createCounter('postgraphile.readiness.attempts')
const readinessDuration = meter.createHistogram('postgraphile.readiness.duration', {
	description: 'Restricted-role database readiness probe duration',
	unit: 'ms',
})

const readinessMetrics: ReadinessMetrics = {
	record(durationMs, outcome) {
		const attributes = { outcome }
		readinessAttempts.add(1, attributes)
		readinessDuration.record(durationMs, attributes)
	},
}

const timeoutError = Symbol('readiness-timeout')

export function createReadinessService(
	probe: ReadinessProbe,
	config: ReadinessServiceConfig,
	metrics: ReadinessMetrics = readinessMetrics,
): ReadinessService {
	let cached: { expiresAt: number; result: ReadinessResult } | undefined
	let inFlight: Promise<ReadinessResult> | undefined
	let underlying: Promise<void> | undefined
	let disposed = false

	function runProbe(): Promise<ReadinessResult> {
		const startedAt = performance.now()
		let timeout: Timer | undefined
		let outcome: 'ready' | 'error' | 'timeout' = 'error'
		let attempt: ReadinessAttempt
		try {
			attempt = probe.start()
		} catch {
			metrics.record(performance.now() - startedAt, outcome)
			underlying = Promise.resolve()
			return Promise.resolve({ ok: false })
		}
		underlying = attempt.promise.catch(() => undefined)

		const timeoutPromise = new Promise<never>((_, reject) => {
			timeout = setTimeout(() => {
				outcome = 'timeout'
				try {
					attempt.cancel()
				} catch {
					// Timeout response must not depend on cancellation transport succeeding.
				} finally {
					reject(timeoutError)
				}
			}, config.timeoutMs)
		})

		return Promise.race([attempt.promise, timeoutPromise])
			.then(() => {
				outcome = 'ready'
				return { ok: true }
			})
			.catch(() => ({ ok: false }))
			.finally(() => {
				if (timeout) clearTimeout(timeout)
				metrics.record(performance.now() - startedAt, outcome)
			})
	}

	return {
		check() {
			if (disposed) return Promise.resolve({ ok: false })

			const now = Date.now()
			if (cached && cached.expiresAt > now) return Promise.resolve(cached.result)
			if (inFlight) return inFlight

			inFlight = runProbe().then((result) => {
				cached = { result, expiresAt: Date.now() + config.cacheMs }
				return result
			})

			// Keep returning the bounded result until underlying runtime query settles.
			// This prevents readiness polling from accumulating abandoned pool waiters.
			const activeUnderlying = underlying
			void activeUnderlying?.finally(() => {
				if (underlying === activeUnderlying) {
					underlying = undefined
					inFlight = undefined
				}
			})
			return inFlight
		},
		async dispose() {
			disposed = true
			cached = undefined
			await Promise.all([inFlight, underlying])
			await probe.close()
		},
	}
}
