import type { TaskSpec } from '../queueTypes'

export function cronJobOptions(
	task: string,
	defaults: TaskSpec,
	taskSpec: TaskSpec = {},
): TaskSpec {
	return {
		...defaults,
		...taskSpec,
		jobKey: taskSpec.jobKey ?? `cron:${task}`,
	}
}
