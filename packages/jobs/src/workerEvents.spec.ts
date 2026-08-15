import { expect, mock, test } from 'bun:test'
import {
	createJobWorkerEvents,
	WORKER_POOL_MARKER_LOCK_NAMESPACE,
	WORKER_POOL_MARKER_SQL,
} from './workerEvents'

function createLogger() {
	return {
		debug: mock(() => {}),
		error: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
	}
}

test('registers pool marker and logs job start and nested failure metadata', async () => {
	const logger = createLogger()
	const onPoolCreated = mock((_poolId: string) => {})
	const events = createJobWorkerEvents({ logger, onPoolCreated })
	const query = mock(async () => ({ rows: [] }))
	let drain: (() => void) | undefined
	const once = mock((event: string, listener: () => void) => {
		if (event === 'drain') drain = listener
	})
	const forcefulShutdown = mock(async () => ({ forceFailedJobs: [] }))
	const workerPool = { forcefulShutdown, id: 'pool-live' }

	events.emit('pool:create', { workerPool } as never)
	events.emit('pool:listen:success', { client: { once, query }, workerPool } as never)
	expect(query).not.toHaveBeenCalled()
	drain?.()
	await Promise.resolve()

	expect(onPoolCreated).toHaveBeenCalledWith('pool-live')
	expect(query).toHaveBeenCalledWith(WORKER_POOL_MARKER_SQL, [
		WORKER_POOL_MARKER_LOCK_NAMESPACE,
		'pool-live',
	])

	const job = {
		attempts: 2,
		id: '424337',
		job_queue_id: null,
		max_attempts: 3,
		task_identifier: 'updateLevelScore',
	}
	const worker = { workerPool }
	events.emit('job:start', { job, worker } as never)
	const cause = Object.assign(new Error('lock timeout'), { code: '55P03' })
	events.emit('job:error', {
		error: Object.assign(new Error('Failed query'), { cause }),
		job,
		worker,
	} as never)

	expect(logger.info).toHaveBeenCalledWith(
		'Graphile job started.',
		expect.objectContaining({ jobId: '424337', poolId: 'pool-live' }),
	)
	expect(logger.error).toHaveBeenCalledWith(
		'Graphile job failed.',
		expect.objectContaining({
			postgres: expect.objectContaining({ code: '55P03', message: 'lock timeout' }),
		}),
	)
})

test('stops pool when liveness marker registration fails', async () => {
	const logger = createLogger()
	const events = createJobWorkerEvents({ logger })
	const markerError = Object.assign(new Error('connection closed'), { code: '08006' })
	const forcefulShutdown = mock(async () => ({ forceFailedJobs: [] }))
	const workerPool = { forcefulShutdown, id: 'pool-broken' }
	let drain: (() => void) | undefined
	events.emit('pool:listen:success', {
		client: {
			once: (_event: string, listener: () => void) => {
				drain = listener
			},
			query: mock(async () => Promise.reject(markerError)),
		},
		workerPool,
	} as never)
	drain?.()
	await new Promise((resolve) => setTimeout(resolve, 0))

	expect(forcefulShutdown).toHaveBeenCalledWith('Worker pool liveness marker registration failed')
})
