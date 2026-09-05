import cluster from 'node:cluster'
import { jobsConfig } from '@zeepkist/core/config/jobs'
import { createSqlClient } from '@zeepkist/core/sql'
import type { JobLane } from './queueTypes'
import { startCrons, startRunner, stopCrons, stopRunner } from './worker'
import { createQueueWorkerUtils } from './workerUtils'

let stopping = false
if (cluster.isPrimary) {
	const queue = await createQueueWorkerUtils()
	const scheduler = createSqlClient(jobsConfig.databaseUrl, {
		max: 1,
		idleTimeout: 0,
		maxLifetime: 0,
		onclose: () => {
			stopCrons()
			if (!stopping) process.exit(1)
		},
	})
	const connection = await scheduler.reserve()
	let leader = false
	const elect = async () => {
		if (stopping || leader) return
		const [row] = await connection`SELECT pg_try_advisory_lock(1861284951,0) AS acquired`
		if (row?.acquired && !stopping) {
			leader = true
			startCrons((task, payload, spec) => queue.addJob(task, payload, spec))
		}
	}
	await elect()
	const election = setInterval(() => {
		void elect().catch(() => {
			stopCrons()
			process.exit(1)
		})
	}, 5000)
	const lanes = new Map<number, JobLane>()
	const fork = (lane: JobLane) => {
		const child = cluster.fork({ JOBS_LANE: lane })
		lanes.set(child.id, lane)
	}
	fork('fast')
	fork('bulk')
	cluster.on('exit', (child) => {
		const lane = lanes.get(child.id)
		lanes.delete(child.id)
		if (!stopping && lane)
			setTimeout(() => {
				if (!stopping) fork(lane)
			}, 1000)
	})
	const shutdown = async () => {
		if (stopping) return
		stopping = true
		clearInterval(election)
		stopCrons()
		const children = Object.values(cluster.workers ?? {}).filter((child) => child !== undefined)
		const exited = children.map(
			(child) =>
				new Promise<void>((resolve) => {
					child.once('exit', () => resolve())
					child.kill('SIGTERM')
				}),
		)
		const deadline = setTimeout(() => {
			for (const child of children) child.process.kill('SIGKILL')
		}, 30_000)
		await Promise.all(exited)
		clearTimeout(deadline)
		await connection`SELECT pg_advisory_unlock(1861284951,0)`
		connection.release()
		await scheduler.close()
		await queue.release()
		process.exit(0)
	}
	process.on('SIGTERM', () => void shutdown())
	process.on('SIGINT', () => void shutdown())
} else {
	const lane = process.env.JOBS_LANE
	if (lane !== 'fast' && lane !== 'bulk') throw new Error('Invalid jobs worker lane')
	await startRunner(lane)
	const shutdown = async () => {
		if (stopping) return
		stopping = true
		const deadline = setTimeout(() => process.exit(1), 30_000)
		await stopRunner()
		const { closeDatabase } = await import('@zeepkist/database')
		await closeDatabase()
		const { stopNodeTelemetry } = await import('@zeepkist/telemetry')
		await stopNodeTelemetry()
		clearTimeout(deadline)
		process.exit(0)
	}
	process.on('disconnect', () => void shutdown())
	process.on('SIGTERM', () => void shutdown())
	process.on('SIGINT', () => void shutdown())
}
