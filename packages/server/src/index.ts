import cluster from 'node:cluster'

const WORKER_COUNT = 2

if (cluster.isPrimary) {
	let shuttingDown = false
	let restartDelayMs = 250
	process.title = 'zeepcentraal-api: primary'
	console.info(`API primary (PID ${process.pid}) started, forking ${WORKER_COUNT} workers...`)

	for (let i = 0; i < WORKER_COUNT; i++) {
		cluster.fork()
	}

	cluster.on('exit', (worker) => {
		if (shuttingDown) {
			return
		}
		console.warn(`API worker ${worker.process.pid} died, restarting...`)
		setTimeout(() => cluster.fork(), restartDelayMs)
		restartDelayMs = Math.min(restartDelayMs * 2, 30_000)
	})

	const shutdownPrimary = (signal: string) => {
		shuttingDown = true
		console.info(`API primary received ${signal}, stopping workers...`)
		for (const worker of Object.values(cluster.workers ?? {})) {
			worker?.process.kill(signal as NodeJS.Signals)
		}
	}
	process.on('SIGINT', () => shutdownPrimary('SIGINT'))
	process.on('SIGTERM', () => shutdownPrimary('SIGTERM'))
} else {
	process.title = 'zeepcentraal-api: worker'
	const { config } = await import('./config')
	const { buildServer } = await import('./server')

	const app = buildServer()

	app.listen({
		hostname: config.host,
		port: config.port,
	})

	console.info(`API worker ${process.pid} listening on ${config.host}:${config.port}`)

	async function gracefulShutdown(signal: string) {
		console.info(`API worker ${process.pid} received ${signal}, shutting down...`)
		await app.stop()
		const [{ closeQueue }, { closeDatabase }] = await Promise.all([
			import('@zeepkist/jobs/queue'),
			import('@zeepkist/database'),
		])
		await Promise.all([closeQueue(), closeDatabase()])
		process.exit(0)
	}

	process.on('SIGINT', () => void gracefulShutdown('SIGINT'))
	process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
}
