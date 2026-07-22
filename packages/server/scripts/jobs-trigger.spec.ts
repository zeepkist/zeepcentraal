import { describe, expect, mock, test } from 'bun:test'
import { main, runSendHttp } from './jobs-trigger.ts'
import type {
	ConfirmPromptOptions,
	PromptAdapter,
	SelectPromptOptions,
	TextPromptOptions,
} from './utils/prompts.ts'
import { PromptCancelledError } from './utils/prompts.ts'
import type { JobTriggerProgress, JobTriggerUi } from './utils/ui.ts'

class ScriptedPrompt implements PromptAdapter {
	readonly #selections: unknown[]
	readonly #confirmations: boolean[]
	readonly #texts: string[]

	constructor({
		selections = [],
		confirmations = [],
		texts = [],
	}: {
		selections?: unknown[]
		confirmations?: boolean[]
		texts?: string[]
	}) {
		this.#selections = [...selections]
		this.#confirmations = [...confirmations]
		this.#texts = [...texts]
	}

	async select<Value extends string | number | boolean>(
		_options: SelectPromptOptions<Value>,
	): Promise<Value> {
		return this.#take(this.#selections, 'selection') as Value
	}

	async confirm(_options: ConfirmPromptOptions): Promise<boolean> {
		return this.#take(this.#confirmations, 'confirmation')
	}

	async text(_options: TextPromptOptions): Promise<string> {
		return this.#take(this.#texts, 'text')
	}

	#take<Value>(values: Value[], kind: string): Value {
		const value = values.shift()
		if (value === undefined) {
			throw new Error(`Missing scripted ${kind}`)
		}
		return value
	}
}

class CapturingUi implements JobTriggerUi {
	readonly events: string[] = []
	readonly previews: Array<{ message: string; title: string }> = []

	intro(message: string): void {
		this.events.push(`intro:${message}`)
	}

	preview(message: string, title: string): void {
		this.previews.push({ message, title })
	}

	outro(message: string): void {
		this.events.push(`outro:${message}`)
	}

	cancel(message: string): void {
		this.events.push(`cancel:${message}`)
	}

	error(message: string): void {
		this.events.push(`error:${message}`)
	}

	progress(): JobTriggerProgress {
		return {
			start: (message) => this.events.push(`progress:start:${message}`),
			stop: (message) => this.events.push(`progress:stop:${message}`),
			error: (message) => this.events.push(`progress:error:${message}`),
		}
	}
}

describe('interactive job trigger', () => {
	test('sends one configured local job and previews exact request', async () => {
		const prompt = new ScriptedPrompt({
			selections: ['local', 'updatePlayerScore'],
			texts: ['42'],
			confirmations: [true],
		})
		const ui = new CapturingUi()
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))

		expect(
			await runSendHttp({
				environment: {
					BACKEND_URL: 'http://localhost:5000/',
					TRIGGER_JOB_TOKEN: 'job-secret',
				},
				prompt,
				ui,
				fetchImpl,
			}),
		).toBe('sent')

		const request = { Task: 'updatePlayerScore', Options: { idUser: 42 } }
		expect(ui.previews).toEqual([
			{
				title: 'Local · http://localhost:5000/job/trigger',
				message: JSON.stringify(request, null, 2),
			},
		])
		expect(fetchImpl).toHaveBeenCalledWith(
			'http://localhost:5000/job/trigger',
			expect.objectContaining({ body: JSON.stringify(request) }),
		)
		expect(ui.events).toContain('progress:stop:Request accepted (HTTP 200)')
		expect(ui.events).toContain('outro:updatePlayerScore queued')
	})

	test('sends targeted ZSL author repair from jobs trigger', async () => {
		const prompt = new ScriptedPrompt({
			selections: ['local', 'syncWorkshopCatalog', 'repair-zsl'],
			confirmations: [true],
		})
		const ui = new CapturingUi()
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))

		expect(
			await runSendHttp({
				environment: {
					BACKEND_URL: 'http://localhost:5000',
					TRIGGER_JOB_TOKEN: 'job-secret',
				},
				prompt,
				ui,
				fetchImpl,
			}),
		).toBe('sent')

		const request = { Task: 'syncWorkshopCatalog', Options: { repairZslAuthors: true } }
		expect(ui.previews[0]?.message).toBe(JSON.stringify(request, null, 2))
		expect(fetchImpl).toHaveBeenCalledWith(
			'http://localhost:5000/job/trigger',
			expect.objectContaining({ body: JSON.stringify(request) }),
		)
	})

	test('uses fixed production endpoint and exact task-name guard', async () => {
		const prompt = new ScriptedPrompt({
			selections: ['production', 'updatePlayerScores'],
			texts: ['updatePlayerScores'],
		})
		const ui = new CapturingUi()
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))

		expect(
			await runSendHttp({
				environment: { TRIGGER_JOB_TOKEN: 'job-secret' },
				prompt,
				ui,
				fetchImpl,
			}),
		).toBe('sent')
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://backend.zeepki.st/job/trigger',
			expect.any(Object),
		)
	})

	test('does not send when local confirmation or production guard fails', async () => {
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))

		for (const prompt of [
			new ScriptedPrompt({
				selections: ['local', 'updatePlayerScores'],
				confirmations: [false],
			}),
			new ScriptedPrompt({
				selections: ['production', 'updatePlayerScores'],
				texts: ['wrong-task'],
			}),
		]) {
			expect(
				await runSendHttp({
					environment: {
						BACKEND_URL: 'http://localhost:5000',
						TRIGGER_JOB_TOKEN: 'job-secret',
					},
					prompt,
					ui: new CapturingUi(),
					fetchImpl,
				}),
			).toBe('cancelled')
		}

		expect(fetchImpl).not.toHaveBeenCalled()
	})

	test('handles prompt cancellation without sending', async () => {
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))
		const prompt = {
			select: async () => {
				throw new PromptCancelledError()
			},
			confirm: async () => false,
			text: async () => '',
		} as PromptAdapter
		const ui = new CapturingUi()

		expect(
			await runSendHttp({
				environment: { TRIGGER_JOB_TOKEN: 'job-secret' },
				prompt,
				ui,
				fetchImpl,
			}),
		).toBe('cancelled')
		expect(fetchImpl).not.toHaveBeenCalled()
		expect(ui.events).toContain('cancel:Request cancelled')
	})

	test('reports missing trigger token without prompting a request', async () => {
		const fetchImpl = mock(async () => new Response(null, { status: 200 }))
		const ui = new CapturingUi()

		expect(
			await main({
				environment: { BACKEND_URL: 'http://localhost:5000' },
				prompt: new ScriptedPrompt({ selections: [] }),
				ui,
				fetchImpl,
			}),
		).toBe(1)
		expect(fetchImpl).not.toHaveBeenCalled()
		expect(ui.events).toContain('error:TRIGGER_JOB_TOKEN is not defined')
	})
})
