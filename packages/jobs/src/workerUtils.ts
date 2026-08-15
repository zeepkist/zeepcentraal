import { jobsConfig } from '@zeepkist/core/config/jobs'
import { makeWorkerUtils } from 'graphile-worker'

type QueueWorkerUtilsConfig = Pick<typeof jobsConfig, 'databaseUrl' | 'queuePoolMax'>

export function createQueueWorkerUtilsOptions(config: QueueWorkerUtilsConfig = jobsConfig) {
	return {
		connectionString: config.databaseUrl,
		maxPoolSize: config.queuePoolMax,
	}
}

export function createQueueWorkerUtils() {
	return makeWorkerUtils(createQueueWorkerUtilsOptions())
}
