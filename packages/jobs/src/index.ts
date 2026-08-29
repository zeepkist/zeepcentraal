import { startNodeTelemetryFromEnvironment } from '@zeepkist/telemetry'

startNodeTelemetryFromEnvironment('jobs')
const [{ jobsConfig }, { applyJobsDatabaseTimeoutEnvironment }] = await Promise.all([
	import('@zeepkist/core/config/jobs'),
	import('./utils/jobsDatabaseTimeouts'),
])
applyJobsDatabaseTimeoutEnvironment(jobsConfig)
await import('./jobsRuntime')
