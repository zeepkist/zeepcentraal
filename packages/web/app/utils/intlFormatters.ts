export type NumberFormatPreset =
	| 'default'
	| 'one-decimal'
	| 'two-decimal'
	| 'compact-one-decimal'
	| 'percent-integer'
	| 'percent-one-decimal'
	| 'megabyte-one-decimal'

export type DateTimeFormatPreset = 'medium-london' | 'month-london' | 'year-london'

const maximumEntries = 32
const numberFormats = new Map<string, Intl.NumberFormat>()
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>()

const numberOptions: Record<NumberFormatPreset, Intl.NumberFormatOptions> = {
	default: {},
	'one-decimal': { maximumFractionDigits: 1 },
	'two-decimal': { maximumFractionDigits: 2 },
	'compact-one-decimal': { notation: 'compact', maximumFractionDigits: 1 },
	'percent-integer': { style: 'percent', maximumFractionDigits: 0 },
	'percent-one-decimal': { style: 'percent', maximumFractionDigits: 1 },
	'megabyte-one-decimal': {
		style: 'unit',
		unit: 'megabyte',
		maximumFractionDigits: 1,
	},
}

const dateTimeOptions: Record<DateTimeFormatPreset, Intl.DateTimeFormatOptions> = {
	'medium-london': { dateStyle: 'medium', timeZone: 'Europe/London' },
	'month-london': { month: 'long', timeZone: 'Europe/London' },
	'year-london': { year: 'numeric', timeZone: 'Europe/London' },
}

export function getNumberFormatter(
	locale: string | undefined,
	preset: NumberFormatPreset = 'default',
): Intl.NumberFormat {
	const key = `${locale ?? 'default'}:${preset}`
	return getBounded(
		numberFormats,
		key,
		() => new Intl.NumberFormat(locale, numberOptions[preset]),
	)
}

export function getDateTimeFormatter(
	locale: string | undefined,
	preset: DateTimeFormatPreset,
): Intl.DateTimeFormat {
	const key = `${locale ?? 'default'}:${preset}`
	return getBounded(
		dateTimeFormats,
		key,
		() => new Intl.DateTimeFormat(locale, dateTimeOptions[preset]),
	)
}

function getBounded<T>(cache: Map<string, T>, key: string, create: () => T): T {
	const cached = cache.get(key)
	if (cached) return cached
	if (cache.size >= maximumEntries) {
		const oldest = cache.keys().next().value
		if (oldest !== undefined) cache.delete(oldest)
	}
	const value = create()
	cache.set(key, value)
	return value
}
