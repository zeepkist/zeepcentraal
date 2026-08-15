import { jobsConfig } from '@zeepkist/core/config/jobs'
import { applyJobsDatabaseTimeoutEnvironment } from './utils/jobsDatabaseTimeouts'

applyJobsDatabaseTimeoutEnvironment(jobsConfig)
await import('./jobsRuntime')
