import { EventEmitter } from 'node:events'
import type { WorkerEvents } from 'graphile-worker'
import { getPostgresErrorMetadata } from './utils/postgresError'

export const WORKER_POOL_MARKER_LOCK_NAMESPACE = 1_861_284_948
export const WORKER_POOL_MARKER_SQL = 'SELECT pg_advisory_lock($1::integer, hashtext($2::text))'

interface WorkerEventLogger {
	debug(message: string, metadata?: Record<string, unknown>): void
	error(message: string, metadata?: Record<string, unknown>): void
	info(message: string, metadata?: Record<string, unknown>): void
	warn(message: string, metadata?: Record<string, unknown>): void
}

export function createJobWorkerEvents({
	logger = console,
	onPoolCreated,
}: {
	logger?: WorkerEventLogger
	onPoolCreated?: (poolId: string) => void
} = {}): WorkerEvents {
	const events = new EventEmitter() as WorkerEvents

	events.on('pool:create', ({ workerPool }) => {
		onPoolCreated?.(workerPool.id)
		logger.info('Graphile worker pool created.', { poolId: workerPool.id })
	})

	events.on('pool:listen:success', ({ client, workerPool }) => {
		// Graphile emits before its LISTEN query. Wait for that query to finish instead of
		// queueing another query on the listener client while it is active.
		client.once('drain', () => {
			void client
				.query(WORKER_POOL_MARKER_SQL, [WORKER_POOL_MARKER_LOCK_NAMESPACE, workerPool.id])
				.then(() => {
					logger.info('Graphile worker pool liveness marker registered.', {
						poolId: workerPool.id,
					})
				})
				.catch((error) => {
					logger.error('Graphile worker pool liveness marker registration failed.', {
						poolId: workerPool.id,
						postgres: getPostgresErrorMetadata(error),
					})
					void Promise.resolve(
						workerPool.forcefulShutdown(
							'Worker pool liveness marker registration failed',
						),
					).catch((shutdownError) => {
						logger.error('Graphile worker pool shutdown after marker failure failed.', {
							poolId: workerPool.id,
							postgres: getPostgresErrorMetadata(shutdownError),
						})
					})
				})
		})
	})

	events.on('job:start', ({ job, worker }) => {
		logger.info('Graphile job started.', {
			attempt: job.attempts,
			jobId: job.id,
			maxAttempts: job.max_attempts,
			poolId: worker.workerPool.id,
			queueId: job.job_queue_id,
			task: job.task_identifier,
		})
	})

	events.on('job:error', ({ error, job, worker }) => {
		logger.error('Graphile job failed.', {
			attempt: job.attempts,
			jobId: job.id,
			maxAttempts: job.max_attempts,
			poolId: worker.workerPool.id,
			postgres: getPostgresErrorMetadata(error),
			queueId: job.job_queue_id,
			task: job.task_identifier,
		})
	})

	return events
}
