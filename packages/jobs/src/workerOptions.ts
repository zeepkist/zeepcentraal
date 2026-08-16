export const JOBS_WORKER_CONCURRENCY = 14

export const jobsWorkerPreset = {
	worker: {
		localQueue: { size: JOBS_WORKER_CONCURRENCY + 1 },
		completeJobBatchDelay: 50,
		failJobBatchDelay: 250,
	},
} as const
