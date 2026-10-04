export class InputValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'InputValidationError'
	}
}

const splitList = (value: string): string[] =>
	value
		.trim()
		.split(/[\s,]+/)
		.filter((entry) => entry.length > 0)

const assertListLength = (values: readonly unknown[], label: string, maximum?: number): void => {
	if (values.length === 0) {
		throw new InputValidationError(`${label} requires at least one value`)
	}

	if (maximum !== undefined && values.length > maximum) {
		throw new InputValidationError(`${label} accepts at most ${maximum} values`)
	}
}

export function parsePositiveSafeInteger(value: string, label = 'Value'): number {
	const normalized = value.trim()
	if (!/^[1-9]\d*$/.test(normalized)) {
		throw new InputValidationError(`${label} must be a positive integer`)
	}

	const parsed = Number(normalized)
	if (!Number.isSafeInteger(parsed)) {
		throw new InputValidationError(`${label} must be a safe integer`)
	}

	return parsed
}

export function parseNonnegativeSafeInteger(value: string, label = 'Value'): number {
	const normalized = value.trim()
	if (!/^\d+$/.test(normalized)) {
		throw new InputValidationError(`${label} must be a non-negative integer`)
	}

	const parsed = Number(normalized)
	if (!Number.isSafeInteger(parsed)) {
		throw new InputValidationError(`${label} must be a safe integer`)
	}

	return parsed
}

export function parseBoundedPositiveSafeInteger(
	value: string,
	maximum: number,
	label = 'Value',
): number {
	const parsed = parsePositiveSafeInteger(value, label)
	if (parsed > maximum) {
		throw new InputValidationError(`${label} must be at most ${maximum}`)
	}

	return parsed
}

export function parsePositiveSafeIntegerList(
	value: string,
	options: { label?: string; maximum?: number } = {},
): number[] {
	const label = options.label ?? 'Values'
	const parsed = splitList(value).map((entry) => parsePositiveSafeInteger(entry, label))
	const unique = [...new Set(parsed)]
	assertListLength(unique, label, options.maximum)
	return unique
}

export function parseWorkshopId(value: string, label = 'Workshop ID'): string {
	const normalized = value.trim()
	if (!/^[1-9]\d*$/.test(normalized)) {
		throw new InputValidationError(`${label} must be a positive decimal string`)
	}

	return normalized
}

export function parseWorkshopIdList(
	value: string,
	options: { label?: string; maximum?: number } = {},
): string[] {
	const label = options.label ?? 'Workshop IDs'
	const parsed = splitList(value).map((entry) => parseWorkshopId(entry, label))
	const unique = [...new Set(parsed)]
	assertListLength(unique, label, options.maximum)
	return unique
}

export function getValidationMessage<T>(
	value: string,
	parser: (input: string) => T,
): string | undefined {
	try {
		parser(value)
		return undefined
	} catch (error) {
		return error instanceof Error ? error.message : 'Invalid value'
	}
}
