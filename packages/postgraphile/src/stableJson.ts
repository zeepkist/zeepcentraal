export function stableStringify(value: unknown): string {
	return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortValue)
	}

	if (!value || typeof value !== 'object') {
		return value
	}

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entryValue]) => [key, sortValue(entryValue)]),
	)
}
