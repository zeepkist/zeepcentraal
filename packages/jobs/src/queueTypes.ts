export type JobLane = 'fast' | 'bulk'
export interface TaskSpec {
	jobKey?: string
	lane?: JobLane
	maxAttempts?: number
	queueName?: string
	runAt?: Date
}
export interface AddJobsJobSpec extends TaskSpec {
	identifier: string
	payload?: unknown
}
export interface Job {
	attempts: number
	id: string
	max_attempts: number
	task_identifier: string
}
export interface WorkerUtils {
	addJob(identifier: string, payload?: unknown, spec?: TaskSpec): Promise<Job>
	addJobs(specs: readonly AddJobsJobSpec[]): Promise<Job[]>
	release(): Promise<void>
}
export interface Helpers extends WorkerUtils {
	getQueueName(): Promise<string>
	job: Job
	logger: Pick<Console, 'info' | 'warn' | 'error' | 'debug'>
}
export type JobHelpers = Helpers
