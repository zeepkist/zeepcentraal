// Equivalent evaluation slice, not the production API or a mock of its full cost.
import cluster from 'node:cluster'

const workers = Number(process.env.BENCH_WORKERS ?? '1')
if (![1, 2].includes(workers)) throw new Error('BENCH_WORKERS must be 1 or 2')
if (workers === 2 && cluster.isPrimary) {
	cluster.fork()
	cluster.fork()
	process.on('SIGTERM', () => {
		for (const worker of Object.values(cluster.workers ?? {})) worker?.kill('SIGTERM')
		setTimeout(() => process.exit(0), 1000)
	})
} else {
	const { app, client } = await import('./app')
	app.listen({ hostname: '127.0.0.1', port: 4310, reusePort: true })
	process.on('SIGTERM', async () => {
		await app.stop()
		await client.close()
		process.exit(0)
	})
}
