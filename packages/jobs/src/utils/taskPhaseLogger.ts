import type { Helpers } from 'graphile-worker'
import { getPostgresErrorMetadata } from './postgresError'

export const SLOW_TASK_PHASE_MS = 10_000

type PhaseOperation = <T>(phase: string, operation: () => Promise<T>) => Promise<T>

export function createTaskPhaseLogger({
	logger,
	metadata = {},
	scope,
	slowMs = SLOW_TASK_PHASE_MS,
}: {
	logger: Helpers['logger']
	metadata?: Record<string, unknown>
	scope: string
	slowMs?: number
}): { run: PhaseOperation; timings: Record<string, number> } {
	const timings: Record<string, number> = {}

	const run: PhaseOperation = async (phase, operation) => {
		const startedAt = Date.now()
		logger.debug(`${scope} phase started: ${phase}.`, { ...metadata, phase })
		const slowTimer = setTimeout(() => {
			logger.warn(`${scope} phase still running: ${phase}.`, {
				...metadata,
				phase,
				durationMs: Date.now() - startedAt,
			})
		}, slowMs)

		try {
			const result = await operation()
			const durationMs = Date.now() - startedAt
			timings[`${phase}Ms`] = durationMs
			logger.info(`${scope} phase completed: ${phase}.`, {
				...metadata,
				phase,
				durationMs,
			})
			return result
		} catch (error) {
			const durationMs = Date.now() - startedAt
			timings[`${phase}Ms`] = durationMs
			logger.error(`${scope} phase failed: ${phase}.`, {
				...metadata,
				phase,
				durationMs,
				postgres: getPostgresErrorMetadata(error),
				timings: { ...timings },
			})
			throw error
		} finally {
			clearTimeout(slowTimer)
		}
	}

	return { run, timings }
}
