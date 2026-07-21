import type { TaskSpec } from 'graphile-worker'

export function cronJobOptions(
	task: string,
	defaults: TaskSpec,
	taskSpec: TaskSpec = {},
): TaskSpec {
	return {
		...defaults,
		...taskSpec,
		jobKey: taskSpec.jobKey ?? `cron:${task}`,
		jobKeyMode: taskSpec.jobKeyMode ?? 'preserve_run_at',
	}
}
