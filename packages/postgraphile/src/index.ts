import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { stopServerWithEscalation } from './processLifecycle'
import { runPostGraphileReadyCheck } from './readinessCli'

async function main() {
	if (
		process.argv.some(
			(argument) => argument === '--ready-check' || argument === '--healthcheck',
		)
	) {
		process.exitCode = await runPostGraphileReadyCheck({
			port: postgraphileConfig.port,
			timeoutMs: postgraphileConfig.readiness.timeoutMs,
		})
		return
	}

	process.env.GRAPHILE_ENV ??= postgraphileConfig.nodeEnv

	if (postgraphileConfig.nodeEnv === 'production') {
		const { assertRestrictedGraphqlDatabaseRole } = await import('./databaseRoleAudit')
		await assertRestrictedGraphqlDatabaseRole(postgraphileConfig.databaseUrl)
	}

	const { app } = await import('./app')
	await using appLifetime = {
		async [Symbol.asyncDispose]() {
			try {
				const result = await stopServerWithEscalation(app)
				if (result === 'forced') {
					console.warn(
						'PostGraphile graceful shutdown timed out; active transports were closed.',
					)
				} else if (result === 'timed-out') {
					console.error(
						'PostGraphile shutdown did not complete after forced transport closure.',
					)
					process.exit(1)
				}
			} catch (error) {
				console.error('PostGraphile failed to shut down cleanly.', error)
				process.exit(1)
			}
		},
	}

	app.listen({
		hostname: postgraphileConfig.host,
		port: postgraphileConfig.port,
		development: postgraphileConfig.nodeEnv !== 'production',
	})

	console.log(
		`PostGraphile running at http://${postgraphileConfig.host}:${postgraphileConfig.port}/graphiql`,
	)

	await using shutdown = createShutdownSignal()
	await shutdown.promise
	void appLifetime
}

function createShutdownSignal() {
	let resolve!: () => void
	const promise = new Promise<void>((nextResolve) => {
		resolve = nextResolve
	})
	const onSignal = () => resolve()
	process.once('SIGTERM' as never, onSignal)
	process.once('SIGINT' as never, onSignal)

	return {
		promise,
		[Symbol.dispose]() {
			process.off('SIGTERM' as never, onSignal)
			process.off('SIGINT' as never, onSignal)
		},
	}
}

await main()
