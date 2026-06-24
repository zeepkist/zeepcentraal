import cluster from 'node:cluster'
import { jobsConfig } from '@zeepkist/core/config/jobs'
import { makeWorkerUtils } from 'graphile-worker'
import { startCrons, startRunner, stopCrons, stopRunner } from './worker'

const WORKER_COUNT = 2

if (cluster.isPrimary) {
	let shuttingDown = false
	let restartDelayMs = 250
	process.title = 'zeepcentraal-jobs: primary'
	// The primary process manages cron scheduling only — no task processing.
	// Using makeWorkerUtils keeps it lightweight (add-only, no task runner).
	const utils = await makeWorkerUtils({ connectionString: jobsConfig.databaseUrl })
	startCrons((task, payload, spec) => utils.addJob(task, payload, spec))

	console.info(`Jobs primary (PID ${process.pid}) started, forking ${WORKER_COUNT} workers...`)

	for (let i = 0; i < WORKER_COUNT; i++) {
		cluster.fork()
	}

	cluster.on('exit', (worker) => {
		if (shuttingDown) {
			return
		}
		console.warn(`Job worker ${worker.process.pid} died, restarting...`)
		setTimeout(() => cluster.fork(), restartDelayMs)
		restartDelayMs = Math.min(restartDelayMs * 2, 30_000)
	})

	async function shutdownPrimary(signal: string) {
		shuttingDown = true
		console.info(`Received ${signal}, shutting down jobs primary...`)
		stopCrons()
		for (const worker of Object.values(cluster.workers ?? {})) {
			worker?.process.kill(signal as NodeJS.Signals)
		}
		await utils.release()
		const { closeDatabase } = await import('@zeepkist/database')
		await closeDatabase()
		process.exit(0)
	}

	process.on('SIGINT', () => void shutdownPrimary('SIGINT'))
	process.on('SIGTERM', () => void shutdownPrimary('SIGTERM'))
} else {
	process.title = 'zeepcentraal-jobs: worker'
	// Each worker process runs a full graphile-worker runner for task processing.
	await startRunner()

	async function shutdownWorker(signal: string) {
		console.info(`Job worker ${process.pid} received ${signal}, shutting down...`)
		await stopRunner()
		const { closeDatabase } = await import('@zeepkist/database')
		await closeDatabase()
		process.exit(0)
	}

	process.on('SIGINT', () => void shutdownWorker('SIGINT'))
	process.on('SIGTERM', () => void shutdownWorker('SIGTERM'))
}
