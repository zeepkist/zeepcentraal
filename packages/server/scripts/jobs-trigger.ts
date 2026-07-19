import type { CompatibleTaskIdentifier } from '@zeepkist/jobs/task-definitions'
import {
	buildJobTriggerUrl,
	type FetchLike,
	type JobTriggerEnvironment,
	type JobTriggerRequest,
	type JobTriggerTarget,
	resolveBackendUrl,
	sendJobTriggerRequest,
} from './utils/http.ts'
import { collectJobOptions, jobChoices } from './utils/jobs.ts'
import {
	createClackPromptAdapter,
	isPromptCancelledError,
	type PromptAdapter,
} from './utils/prompts.ts'
import { createClackUi, type JobTriggerUi } from './utils/ui.ts'

type SendHttpEnvironment = JobTriggerEnvironment & {
	TRIGGER_JOB_TOKEN?: string
}

export type SendHttpOutcome = 'cancelled' | 'sent'

export interface RunSendHttpOptions {
	environment?: SendHttpEnvironment
	fetchImpl?: FetchLike
	prompt?: PromptAdapter
	ui?: JobTriggerUi
}

const targetChoices = [
	{
		value: 'local',
		label: 'Local',
		hint: 'Use BACKEND_URL from the environment',
	},
	{
		value: 'production',
		label: 'Production',
		hint: 'Use https://backend.zeepki.st',
	},
] as const

export async function runSendHttp({
	environment = process.env,
	fetchImpl = fetch,
	prompt = createClackPromptAdapter(),
	ui = createClackUi(),
}: RunSendHttpOptions = {}): Promise<SendHttpOutcome> {
	ui.intro('ZeepCentraal job trigger')

	try {
		const token = readTriggerToken(environment)
		const target = await prompt.select<JobTriggerTarget>({
			message: 'Choose backend target',
			options: targetChoices,
			initialValue: 'local',
		})
		const url = buildJobTriggerUrl(resolveBackendUrl(target, environment))
		const task = await prompt.select<CompatibleTaskIdentifier>({
			message: 'Choose job',
			options: jobChoices,
		})
		const options = await collectJobOptions(prompt, task)
		const request: JobTriggerRequest = { Task: task, Options: options }

		ui.preview(JSON.stringify(request, null, 2), `${formatTarget(target)} · ${url}`)

		const confirmed = await confirmRequest(prompt, target, task)
		if (!confirmed) {
			ui.cancel('Request cancelled')
			return 'cancelled'
		}

		const progress = ui.progress()
		progress.start('Sending job trigger request')
		try {
			const result = await sendJobTriggerRequest({
				url,
				token,
				request,
				fetchImpl,
			})
			progress.stop(`Request accepted (HTTP ${result.status})`)
		} catch (error) {
			progress.error('Request failed')
			throw error
		}

		ui.outro(`${task} queued`)
		return 'sent'
	} catch (error) {
		if (isPromptCancelledError(error)) {
			ui.cancel('Request cancelled')
			return 'cancelled'
		}
		throw error
	}
}

export async function main(options: RunSendHttpOptions = {}): Promise<number> {
	const ui = options.ui ?? createClackUi()
	try {
		await runSendHttp({ ...options, ui })
		return 0
	} catch (error) {
		ui.error(error instanceof Error ? error.message : 'Unknown error')
		return 1
	}
}

function readTriggerToken(environment: SendHttpEnvironment): string {
	const token = environment.TRIGGER_JOB_TOKEN?.trim()
	if (!token) {
		throw new Error('TRIGGER_JOB_TOKEN is not defined')
	}
	return token
}

async function confirmRequest(
	prompt: PromptAdapter,
	target: JobTriggerTarget,
	task: CompatibleTaskIdentifier,
): Promise<boolean> {
	if (target === 'production') {
		const confirmation = await prompt.text({
			message: `Type ${task} to send this production request`,
			validate: (value) => (value === task ? undefined : `Type ${task} exactly`),
		})
		return confirmation === task
	}

	return prompt.confirm({
		message: 'Send this local request?',
		initialValue: false,
	})
}

function formatTarget(target: JobTriggerTarget): string {
	return target === 'production' ? 'Production' : 'Local'
}

if (import.meta.main) {
	process.exitCode = await main()
}
