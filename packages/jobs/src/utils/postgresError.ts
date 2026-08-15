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
	for (const key of [
		'code',
		'severity',
		'detail',
		'hint',
		'schema',
		'table',
		'column',
		'constraint',
		'routine',
	] as const) {
		const value = records.find((record) => typeof record[key] === 'string')?.[key]
		if (value !== undefined) metadata[key] = value
	}
	const messages = records.flatMap((record) =>
		typeof record.message === 'string' ? [record.message] : [],
	)
	if (messages.length > 0) {
		metadata.wrapperMessage = messages[0]
		metadata.message = messages.at(-1)
		metadata.messages = messages
	}
	return metadata
}
