import cluster, { type Worker } from 'node:cluster'
import { attachLobbyWorker, initializeLobbyWorkerIpc } from './modules/lobby/lobbyIpc'
import { type ClusterWorkerLike, onceAsync, stopClusterWorkers } from './processLifecycle'

const WORKER_COUNT = 2
const clusterEvents = cluster as typeof cluster & {
	on(event: 'exit', listener: (worker: Worker) => void): typeof cluster
}

if (cluster.isPrimary) {
	let shuttingDown = false
	let restartDelayMs = 250
	process.title = 'zeepcentraal-api: primary'
	console.info(`API primary (PID ${process.pid}) started, forking ${WORKER_COUNT} workers...`)

	const workers = () =>
		Object.values(cluster.workers ?? {}).filter(
			(worker): worker is Worker => worker !== undefined,
		)
	const { startLobbyPrimary } = await import('./modules/lobby/lobbyPrimary')
	const lobbyPrimary = startLobbyPrimary(workers)
	const forkWorker = () => {
		const worker = cluster.fork()
		attachLobbyWorker(worker, lobbyPrimary.getSnapshot)
		return worker
	}

	for (let i = 0; i < WORKER_COUNT; i++) {
		forkWorker()
	}

	clusterEvents.on('exit', (worker) => {
		if (shuttingDown) {
			return
		}
		console.warn(`API worker ${worker.process.pid} died, restarting...`)
		setTimeout(() => {
			if (!shuttingDown) {
				forkWorker()
			}
		}, restartDelayMs)
		restartDelayMs = Math.min(restartDelayMs * 2, 30_000)
	})

	const shutdownPrimary = onceAsync(async (signal: NodeJS.Signals) => {
		shuttingDown = true
		console.info(`API primary received ${signal}, stopping lobby collector and workers...`)
		await lobbyPrimary.stop()
		const activeWorkers = Object.values(cluster.workers ?? {})
			.filter((worker): worker is Worker => worker !== undefined)
			.map((worker) => worker as Worker & ClusterWorkerLike)
		const stoppedCleanly = await stopClusterWorkers(activeWorkers, signal)
		if (!stoppedCleanly) {
			console.error('API workers did not stop before shutdown timeout; forced termination.')
		}
		process.exit(stoppedCleanly ? 0 : 1)
	})
	process.on('SIGINT', () => void shutdownPrimary('SIGINT'))
	process.on('SIGTERM', () => void shutdownPrimary('SIGTERM'))
} else {
	process.title = 'zeepcentraal-api: worker'
	initializeLobbyWorkerIpc()
	const { config } = await import('./config')
	const { buildServer } = await import('./server')
	const { initializeQueue } = await import('@zeepkist/jobs/queue')

	const app = buildServer()
	await initializeQueue()

	app.listen({
		hostname: config.host,
		port: config.port,
		maxRequestBodySize: config.maxRequestBodySize,
		development: config.nodeEnv !== 'production',
	})

	console.info(`API worker ${process.pid} listening on ${config.host}:${config.port}`)

	const gracefulShutdown = onceAsync(async (signal: NodeJS.Signals) => {
		console.info(`API worker ${process.pid} received ${signal}, shutting down...`)
		try {
			await app.stop(true)
			const [{ closeQueue }, { closeDatabase }] = await Promise.all([
				import('@zeepkist/jobs/queue'),
				import('@zeepkist/database'),
			])
			await Promise.all([closeQueue(), closeDatabase()])
			process.exit(0)
		} catch (error) {
			console.error(`API worker ${process.pid} failed to shut down cleanly.`, error)
			process.exit(1)
		}
	})

	process.on('SIGINT', () => void gracefulShutdown('SIGINT'))
	process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
}
