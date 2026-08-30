import { startNodeTelemetryFromEnvironment } from '@zeepkist/telemetry'

// Graphile Worker reads this when its modules load. Keep routine startup and
// successful-completion chatter out of both console and exported telemetry logs.
process.env.NO_LOG_SUCCESS = '1'

startNodeTelemetryFromEnvironment('jobs')
const [{ jobsConfig }, { applyJobsDatabaseTimeoutEnvironment }] = await Promise.all([
	import('@zeepkist/core/config/jobs'),
	import('./utils/jobsDatabaseTimeouts'),
])
applyJobsDatabaseTimeoutEnvironment(jobsConfig)
await import('./jobsRuntime')
