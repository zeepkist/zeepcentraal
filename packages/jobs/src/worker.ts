import { config } from '@zeepkist/core'
import { CronJob } from 'cron'
import { run, type TaskSpec } from 'graphile-worker'
import { cronTasks } from './cronTasks'
import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from './priorities'
import { taskList } from './tasks'

export const defaultJobOptions: TaskSpec = {
	priority: DEFAULT_JOB_PRIORITY,
	maxAttempts: 3,
}

export const priorityJobOptions: TaskSpec = {
	priority: PRIORITY_JOB_PRIORITY,
	maxAttempts: 3,
}

let runner: Awaited<ReturnType<typeof run>> | null = null
const cronJobs: CronJob[] = []

export async function startRunner() {
	runner = await run({
		connectionString: config.databaseUrl,
		crontabFile: '',
		concurrency: 14,
		maxPoolSize: 15,
		taskList: taskList as Parameters<typeof run>[0]['taskList'],
		noHandleSignals: true,
		preset: {
			worker: {
				localQueue: { size: 200 },
				completeJobBatchDelay: 0,
				failJobBatchDelay: 0,
			},
		},
	})
	console.info(`Job runner started (PID ${process.pid})`)
}

export async function stopRunner() {
	await runner?.stop()
}

export function startCrons(
	addJob: (task: string, payload: object, spec: TaskSpec) => Promise<unknown>,
) {
	for (const cronTask of cronTasks) {
		const { task, cronTime } = cronTask
		const payload = 'payload' in cronTask ? cronTask.payload : {}
		const job = CronJob.from({
			cronTime,
			onTick: () => {
				void addJob(task, payload, {
					...defaultJobOptions,
					...('spec' in cronTask ? cronTask.spec : {}),
					jobKey: `cron:${task}`,
					jobKeyMode: 'preserve_run_at',
				}).catch((error) => {
					console.error(`Cron enqueue failed for ${task}:`, error)
				})
			},
			start: true,
			timeZone: 'Europe/London',
		})
		cronJobs.push(job)
		console.info(`Cron registered: ${task} (${cronTime})`)
	}
}

export function stopCrons() {
	for (const job of cronJobs) {
		job.stop()
	}
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
