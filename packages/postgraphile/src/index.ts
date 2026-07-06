import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'

process.env.GRAPHILE_ENV ??= postgraphileConfig.nodeEnv

const { buildPostGraphileServer } = await import('./server')
const app = buildPostGraphileServer()

app.listen({
	hostname: postgraphileConfig.host,
	port: postgraphileConfig.port,
	development: postgraphileConfig.nodeEnv !== 'production',
})

console.log(
	`PostGraphile running at http://${postgraphileConfig.host}:${postgraphileConfig.port}/graphiql`,
)

async function shutdown() {
	await app.stop()
	process.exit(0)
}

process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
