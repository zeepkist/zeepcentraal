import { cronTasks } from './cronTasks'
import type { JobLane, TaskSpec } from './queueTypes'
import { cronJobOptions } from './utils/cronJobOptions'
import { startPgmqRunner } from './workerRunner'
export const defaultJobOptions: TaskSpec = { maxAttempts: 3 }
export const priorityJobOptions: TaskSpec = { maxAttempts: 3 }
let runner: Awaited<ReturnType<typeof startPgmqRunner>> | null = null
const cronJobs: Bun.CronJob[] = []
const scheduleCron = Bun.cron as unknown as (
	schedule: string,
	handler: () => unknown,
	options: { tz: string },
) => Bun.CronJob
export async function startRunner(lane: JobLane = 'bulk') {
	runner = await startPgmqRunner(lane)
}
export async function stopRunner() {
	await runner?.stop()
	runner = null
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
