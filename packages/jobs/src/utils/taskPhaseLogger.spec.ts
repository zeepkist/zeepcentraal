import { expect, mock, test } from 'bun:test'
import { createTaskPhaseLogger } from './taskPhaseLogger'

function createLogger() {
	return {
		debug: mock(() => {}),
		error: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
	}
}

test('logs phase lifecycle and warns while a phase remains active', async () => {
	const logger = createLogger()
	const phases = createTaskPhaseLogger({ logger: logger as never, scope: 'test', slowMs: 1 })

	await phases.run('query', async () => {
		await new Promise((resolve) => setTimeout(resolve, 5))
	})

	expect(logger.debug).toHaveBeenCalledWith('test phase started: query.', { phase: 'query' })
	expect(logger.warn).toHaveBeenCalledWith(
		'test phase still running: query.',
		expect.objectContaining({ durationMs: expect.any(Number), phase: 'query' }),
	)
	expect(logger.info).toHaveBeenCalledWith(
		'test phase completed: query.',
		expect.objectContaining({ durationMs: expect.any(Number), phase: 'query' }),
	)
})

test('logs active phase and nested PostgreSQL cause before rethrowing', async () => {
	const logger = createLogger()
	const phases = createTaskPhaseLogger({ logger: logger as never, scope: 'test' })
	const cause = Object.assign(new Error('canceling statement due to statement timeout'), {
		code: '57014',
	})
	const error = Object.assign(new Error('Failed query'), { cause })

	await expect(phases.run('votes', async () => Promise.reject(error))).rejects.toBe(error)
	expect(logger.error).toHaveBeenCalledWith(
		'test phase failed: votes.',
		expect.objectContaining({
			phase: 'votes',
			postgres: expect.objectContaining({
				code: '57014',
				message: 'canceling statement due to statement timeout',
			}),
		}),
	)
})
