import { jobsConfig } from '@zeepkist/core/config/jobs'
import { run, type TaskSpec } from 'graphile-worker'
import { cronTasks } from './cronTasks'
import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from './priorities'
import { taskList } from './tasks'
import { cronJobOptions } from './utils/cronJobOptions'
import { createJobWorkerEvents } from './workerEvents'
import { JOBS_WORKER_CONCURRENCY, jobsWorkerPreset } from './workerOptions'

export const defaultJobOptions: TaskSpec = {
	priority: DEFAULT_JOB_PRIORITY,
	maxAttempts: 3,
}

export const priorityJobOptions: TaskSpec = {
	priority: PRIORITY_JOB_PRIORITY,
	maxAttempts: 3,
}

let runner: Awaited<ReturnType<typeof run>> | null = null
let runnerStop: Promise<void> | null = null
const cronJobs: Bun.CronJob[] = []
const scheduleCron = Bun.cron as unknown as (
	schedule: string,
	handler: () => unknown,
	options: { tz: string },
) => Bun.CronJob

export async function startRunner({
	onPoolCreated,
}: {
	onPoolCreated?: (poolId: string) => void
} = {}) {
	runnerStop = null
	const events = createJobWorkerEvents({ onPoolCreated })
	runner = await run({
		connectionString: jobsConfig.databaseUrl,
		crontabFile: '',
		concurrency: JOBS_WORKER_CONCURRENCY,
		maxPoolSize: 15,
		taskList: taskList as Parameters<typeof run>[0]['taskList'],
		noHandleSignals: true,
		events,
		preset: jobsWorkerPreset,
	})
	console.info(`Job runner started (PID ${process.pid})`)
}

export function stopRunner(): Promise<void> {
	const activeRunner = runner
	if (!activeRunner) {
		return Promise.resolve()
	}

	runnerStop ??= activeRunner.stop().then(() => {
		if (runner === activeRunner) {
			runner = null
		}
	})

	return runnerStop
}

export function startCrons(
	addJob: (task: string, payload: object, spec: TaskSpec) => Promise<unknown>,
) {
	stopCrons()
	for (const cronTask of cronTasks) {
		const { task, cronTime } = cronTask
		const payload = 'payload' in cronTask ? cronTask.payload : {}
		const cronSpec: TaskSpec = 'spec' in cronTask ? cronTask.spec : {}
		const timeZone = 'timeZone' in cronTask ? cronTask.timeZone : 'Europe/London'
		const job = scheduleCron(
			cronTime,
			async () => {
				try {
					await addJob(task, payload, cronJobOptions(task, defaultJobOptions, cronSpec))
				} catch (error) {
					console.error(`Cron enqueue failed for ${task}:`, error)
				}
			},
			{ tz: timeZone },
		)
		cronJobs.push(job)
		console.info(`Cron registered: ${task} (${cronTime}, ${timeZone})`)
	}
}

export function stopCrons() {
	for (const job of cronJobs) {
		job[Symbol.dispose]()
	}
	cronJobs.length = 0
}

// Kept for backwards-compatible single-process startup (e.g. tests / dev without cluster)
export async function startWorker() {
	await startRunner()
	startCrons(async (task, payload, spec) => runner?.addJob(task, payload, spec))
}

export async function stopWorker() {
	stopCrons()
	await stopRunner()
}
