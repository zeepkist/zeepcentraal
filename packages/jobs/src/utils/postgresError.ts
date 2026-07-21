interface ErrorRecord {
	[key: string]: unknown
}

const isErrorRecord = (value: unknown): value is ErrorRecord =>
	typeof value === 'object' && value !== null

export function getPostgresErrorMetadata(error: unknown): Record<string, unknown> {
	const records: ErrorRecord[] = []
	let current: unknown = error
	while (isErrorRecord(current) && records.length < 5) {
		records.push(current)
		current = current.cause
	}

	const metadata: Record<string, unknown> = {}
	for (const key of ['code', 'constraint', 'detail', 'routine'] as const) {
		const value = records.find((record) => typeof record[key] === 'string')?.[key]
		if (value !== undefined) metadata[key] = value
	}
	const message = records.findLast((record) => typeof record.message === 'string')?.message
	if (message !== undefined) metadata.message = message
	return metadata
}
