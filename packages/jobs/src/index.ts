import { startNodeTelemetryFromEnvironment } from '@zeepkist/telemetry'

startNodeTelemetryFromEnvironment('jobs')
const [{ jobsConfig }, { applyJobsDatabaseTimeoutEnvironment }] = await Promise.all([
	import('@zeepkist/core/config/jobs'),
	import('./utils/jobsDatabaseTimeouts'),
])
applyJobsDatabaseTimeoutEnvironment(jobsConfig)
if (process.argv[2] === 'queue') {
	const { runQueueAdmin } = await import('./queueAdmin')
	await runQueueAdmin(process.argv.slice(3))
	const { stopNodeTelemetry } = await import('@zeepkist/telemetry')
	await stopNodeTelemetry()
} else {
	await import('./jobsRuntime')
}
