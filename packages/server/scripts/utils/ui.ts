import { cancel, intro, log, note, outro, spinner } from '@clack/prompts'

export interface JobTriggerProgress {
	error(message: string): void
	start(message: string): void
	stop(message: string): void
}

export interface JobTriggerUi {
	cancel(message: string): void
	error(message: string): void
	intro(message: string): void
	outro(message: string): void
	preview(message: string, title: string): void
	progress(): JobTriggerProgress
}

export function createClackUi(): JobTriggerUi {
	return {
		intro,
		preview: note,
		outro,
		cancel,
		error: log.error,
		progress: spinner,
	}
}
