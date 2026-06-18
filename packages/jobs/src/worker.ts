import { config } from '@zeepkist/core'
import { CronJob } from 'cron'
import { run, type TaskSpec } from 'graphile-worker'
import { taskList } from './tasks'

export const defaultJobOptions: TaskSpec = {
	priority: 5,
	maxAttempts: 3,
}

export const priorityJobOptions: TaskSpec = {
	priority: 0,
	maxAttempts: 3,
}

const cronTasks = [
	// Weekly full recalculation
	{ task: 'updateLevelScores', cronTime: '0 1 * * 1', payload: { all: true } },
	// Near-real-time leaderboard updates
	{ task: 'updateLevelScores', cronTime: '*/10 * * * *', payload: { all: false } },
	{ task: 'updatePlayerScores', cronTime: '5-59/10 * * * *' },
	// History snapshots
	{ task: 'updateLevelPointsHistory', cronTime: '0 * * * *' },
	{ task: 'updateUserPointsHistory', cronTime: '0 0,12 * * *' },
] as const

let runner: Awaited<ReturnType<typeof run>> | null = null
const cronJobs: CronJob[] = []

export async function startRunner() {
	runner = await run({
		connectionString: config.databaseUrl,
		crontabFile: '',
		taskList: taskList as Parameters<typeof run>[0]['taskList'],
		noHandleSignals: true,
		preset: {
			worker: {
				localQueue: { size: 10 },
				completeJobBatchDelay: 100,
				failJobBatchDelay: 100,
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
