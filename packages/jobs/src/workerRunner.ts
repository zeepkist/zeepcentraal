import { getMeter } from '@zeepkist/telemetry'
import type { ClaimedJob } from './pgmq'
import type { JobLane } from './queueTypes'
import { isTaskIdentifier, isValidTaskPayload } from './taskDefinitions'
import { taskList } from './tasks'
import {
	JOB_HEARTBEAT_MS,
	JOB_POLL_MS,
	JOBS_FAST_CONCURRENCY,
	JOBS_WORKER_CONCURRENCY,
} from './workerOptions'
import { createQueueWorkerUtils } from './workerUtils'

export async function startPgmqRunner(lane: JobLane) {
	const queue = await createQueueWorkerUtils(lane)
	const concurrency = lane === 'fast' ? JOBS_FAST_CONCURRENCY : JOBS_WORKER_CONCURRENCY
	const active = new Set<Promise<void>>()
	let stopping = false
	const meter = getMeter('zeepcentraal-jobs')
	const depth = meter.createGauge('messaging.queue.depth')
	const oldest = meter.createGauge('messaging.queue.oldest_age', { unit: 's' })
	const archived = meter.createGauge('messaging.queue.archived')
	let lastMetrics = 0
	async function execute(job: ClaimedJob) {
		let lost = false
		let heartbeat: Promise<void> | undefined
		const timer = setInterval(() => {
			heartbeat ??= queue
				.heartbeat(job)
				.then((ok) => {
					if (!ok) lost = true
				})
				.catch(() => {
					lost = true
				})
				.finally(() => {
					heartbeat = undefined
				})
			// A handler cannot be safely cancelled halfway through external effects. Kill this
			// worker on lease loss; other leases recover after expiry. Never acknowledge stale work.
			void heartbeat.then(() => {
				if (lost) process.exit(1)
			})
		}, JOB_HEARTBEAT_MS)
		try {
			if (!isTaskIdentifier(job.task) || !isValidTaskPayload(job.task, job.payload)) {
				await queue.finish(job, 'invalid_job')
				return
			}
			let failure: string | null = null
			try {
				await taskList[job.task](job.payload, {
					addJob: (task, payload, spec) => queue.addJob(task, payload, { ...spec, lane }),
					addJobs: (specs) => queue.addJobs(specs.map((spec) => ({ ...spec, lane }))),
					release: async () => {},
					logger: console,
					job: {
						id: job.id,
						task_identifier: job.task,
						attempts: job.attempts,
						max_attempts: job.max_attempts,
					},
					getQueueName: async () => `zeepcentraal_${lane}`,
				})
			} catch {
				failure = 'handler_failed'
				console.error('Job attempt failed.', {
					lane,
					id: job.id,
					task: job.task,
					attempt: job.attempts,
				})
			}
			clearInterval(timer)
			await heartbeat
			if (!lost && !(await queue.finish(job, failure)))
				console.warn('Job lease expired before acknowledgement.', { lane, id: job.id })
		} finally {
			clearInterval(timer)
			await heartbeat
		}
	}
	const loop = (async () => {
		while (!stopping) {
			try {
				if (Date.now() - lastMetrics > 10_000) {
					const metrics = await queue.metrics()
					depth.record(metrics.depth, { lane })
					oldest.record(metrics.oldestAge, { lane })
					archived.record(metrics.archived, { lane })
					lastMetrics = Date.now()
				}
				if (active.size < concurrency) {
					const jobs = await queue.claim(concurrency - active.size)
					for (const job of jobs) {
						const work = execute(job)
							.catch(() =>
								console.error('Queue execution failed.', { lane, id: job.id }),
							)
							.finally(() => active.delete(work))
						active.add(work)
					}
				}
			} catch (error) {
				console.error('Queue polling failed.', {
					lane,
					errorName: error instanceof Error ? error.name : 'UnknownError',
				})
			}
			await Bun.sleep(JOB_POLL_MS)
		}
	})()
	return {
		async stop() {
			stopping = true
			await loop
			await Promise.allSettled(active)
			await queue.release()
		},
	}
}
