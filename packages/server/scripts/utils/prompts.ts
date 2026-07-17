import type { Option as ClackPromptOption } from '@clack/prompts'
import {
	confirm as clackConfirm,
	select as clackSelect,
	text as clackText,
	isCancel,
} from '@clack/prompts'

export type PromptPrimitive = string | number | boolean
export type PromptOption<Value extends PromptPrimitive> = ClackPromptOption<Value>

export interface SelectPromptOptions<Value extends PromptPrimitive> {
	initialValue?: Value
	message: string
	options: readonly PromptOption<Value>[]
}

export interface ConfirmPromptOptions {
	initialValue?: boolean
	message: string
}

export interface TextPromptOptions {
	initialValue?: string
	message: string
	placeholder?: string
	validate?: (value: string | undefined) => string | undefined
}

export interface PromptAdapter {
	confirm(options: ConfirmPromptOptions): Promise<boolean>
	select<Value extends PromptPrimitive>(options: SelectPromptOptions<Value>): Promise<Value>
	text(options: TextPromptOptions): Promise<string>
}

export class PromptCancelledError extends Error {
	constructor() {
		super('Prompt cancelled')
		this.name = 'PromptCancelledError'
	}
}

export function isPromptCancelledError(error: unknown): error is PromptCancelledError {
	return error instanceof PromptCancelledError
}

function unwrapPromptResult<Value>(value: Value | symbol): Value {
	if (isCancel(value)) {
		throw new PromptCancelledError()
	}

	return value as Value
}

export function createClackPromptAdapter(): PromptAdapter {
	return {
		async select<Value extends PromptPrimitive>(
			options: SelectPromptOptions<Value>,
		): Promise<Value> {
			const result = await clackSelect<Value>({
				message: options.message,
				options: [...options.options],
				initialValue: options.initialValue,
			})
			return unwrapPromptResult(result)
		},
		async confirm(options: ConfirmPromptOptions): Promise<boolean> {
			const result = await clackConfirm(options)
			return unwrapPromptResult(result)
		},
		async text(options: TextPromptOptions): Promise<string> {
			const result = await clackText(options)
			return unwrapPromptResult(result)
		},
	}
}
