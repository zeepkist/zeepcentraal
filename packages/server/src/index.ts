import cluster from 'node:cluster'

const WORKER_COUNT = 2

if (cluster.isPrimary) {
	process.title = 'zeepcentraal-api: primary'
	console.info(`API primary (PID ${process.pid}) started, forking ${WORKER_COUNT} workers...`)

	for (let i = 0; i < WORKER_COUNT; i++) {
		cluster.fork()
	}

	cluster.on('exit', (worker) => {
		console.warn(`API worker ${worker.process.pid} died, restarting...`)
		cluster.fork()
	})
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
		process.exit(0)
	}

	process.on('SIGINT', () => void gracefulShutdown('SIGINT'))
	process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
}
