import type { Worker } from 'node:cluster'
import cluster from 'node:cluster'
import { getLockedWorkerPools } from './utils/getLockedWorkerPools'
import { recoverOrphanedPlayerScoreQueueLock } from './utils/recoverOrphanedPlayerScoreQueueLock'
import { WORKER_POOL_RECOVERY_INTERVAL_MS, WorkerPoolRecovery } from './utils/workerPoolRecovery'
import { startCrons, startRunner, stopCrons, stopRunner } from './worker'
import { createQueueWorkerUtils } from './workerUtils'

const WORKER_COUNT = 2
const clusterEvents = cluster as typeof cluster & {
	on(event: 'exit', listener: (worker: Worker) => void): typeof cluster
}

function isWorkerPoolMessage(message: unknown): message is { poolId: string; type: string } {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		message.type === 'graphile-worker-pool' &&
		'poolId' in message &&
		typeof message.poolId === 'string'
	)
}

if (cluster.isPrimary) {
	let shuttingDown = false
	let restartDelayMs = 250
	process.title = 'zeepcentraal-jobs: primary'
	// The primary process manages cron scheduling only — no task processing.
	// Using makeWorkerUtils keeps it lightweight (add-only, no task runner).
	const utils = await createQueueWorkerUtils()
	const workerPoolIds = new Map<number, string>()
	const workerPoolRecovery = new WorkerPoolRecovery({
		forceUnlockWorkers: (workerIds) => utils.forceUnlockWorkers(workerIds),
		getLockedPools: getLockedWorkerPools,
	})
	let recoverySweep: Promise<void> | null = null
	const runRecoverySweep = (): Promise<void> => {
		recoverySweep ??= (async () => {
			const recoveredQueueLocks = await recoverOrphanedPlayerScoreQueueLock()
			for (const recovered of recoveredQueueLocks) {
				const lockedAt =
					recovered.lockedAt instanceof Date
						? recovered.lockedAt.getTime()
						: Date.parse(recovered.lockedAt)
				console.warn('Recovered orphaned Graphile player-score queue lock.', {
					queueName: recovered.queueName,
					lockedBy: recovered.lockedBy,
					lockAgeMs: Math.max(0, Date.now() - lockedAt),
				})
			}
			await workerPoolRecovery.sweep()
		})()
			.catch((error) => {
				console.error('Graphile worker pool recovery sweep failed.', { error })
			})
			.finally(() => {
				recoverySweep = null
			})
		return recoverySweep
	}
	void runRecoverySweep()
	const recoveryInterval = setInterval(() => {
		void runRecoverySweep()
	}, WORKER_POOL_RECOVERY_INTERVAL_MS)
	startCrons((task, payload, spec) => utils.addJob(task, payload, spec))

	console.info(`Jobs primary (PID ${process.pid}) started, forking ${WORKER_COUNT} workers...`)

	const forkWorker = () => {
		const worker = cluster.fork()
		worker.on('message', (message) => {
			if (!isWorkerPoolMessage(message)) return
			workerPoolIds.set(worker.id, message.poolId)
			console.info('Registered Graphile worker pool for child process.', {
				poolId: message.poolId,
				workerId: worker.id,
				workerPid: worker.process.pid,
			})
		})
		return worker
	}

	for (let i = 0; i < WORKER_COUNT; i++) {
		forkWorker()
	}

	clusterEvents.on('exit', (worker) => {
		if (shuttingDown) {
			return
		}
		const poolId = workerPoolIds.get(worker.id)
		workerPoolIds.delete(worker.id)
		if (poolId) {
			void workerPoolRecovery.recoverKnownDeadPool(poolId)
		} else {
			console.warn('Exited job worker had no registered Graphile pool ID.', {
				workerId: worker.id,
				workerPid: worker.process.pid,
			})
		}
		console.warn(`Job worker ${worker.process.pid} died, restarting...`)
		setTimeout(() => {
			if (!shuttingDown) {
				forkWorker()
			}
		}, restartDelayMs)
		restartDelayMs = Math.min(restartDelayMs * 2, 30_000)
	})

	let primaryShutdown: Promise<void> | null = null
	function shutdownPrimary(signal: NodeJS.Signals): Promise<void> {
		primaryShutdown ??= (async () => {
			shuttingDown = true
			clearInterval(recoveryInterval)
			console.info(`Received ${signal}, shutting down jobs primary...`)
			stopCrons()
			for (const worker of Object.values(cluster.workers ?? {})) {
				worker?.process.kill(signal)
			}
			await utils.release()
			const { closeDatabase } = await import('@zeepkist/database')
			await closeDatabase()
			process.exit(0)
		})()

		return primaryShutdown
	}

	process.on('SIGINT', () => void shutdownPrimary('SIGINT'))
	process.on('SIGTERM', () => void shutdownPrimary('SIGTERM'))
} else {
	process.title = 'zeepcentraal-jobs: worker'
	// Each worker process runs a full graphile-worker runner for task processing.
	await startRunner({
		onPoolCreated: (poolId) => {
			process.send?.({ poolId, type: 'graphile-worker-pool' })
		},
	})

	let workerShutdown: Promise<void> | null = null
	function shutdownWorker(signal: NodeJS.Signals): Promise<void> {
		workerShutdown ??= (async () => {
			console.info(`Job worker ${process.pid} received ${signal}, shutting down...`)
			await stopRunner()
			const { closeDatabase } = await import('@zeepkist/database')
			await closeDatabase()
			process.exit(0)
		})()

		return workerShutdown
	}

	process.on('SIGINT', () => void shutdownWorker('SIGINT'))
	process.on('SIGTERM', () => void shutdownWorker('SIGTERM'))
}
