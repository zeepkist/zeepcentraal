export interface SourceMessage {
	attachments?: { filename: string }[]
	author: { id: string; bot?: boolean }
	components?: unknown[]
	content: string
	edited_timestamp: string | null
	id: string
	reactions?: { emoji: { name: string }; me: boolean }[]
	timestamp: string
}
export interface SourceSubmission {
	authorId: string
	messageCreatedAt: string
	messageEditedAt: string | null
	messageId: string
	sourceError: string | null
	state: 'selected' | 'superseded' | 'withdrawn'
	workshopId: bigint
}
export function workshopLinks(content: string) {
	const ids = new Set<bigint>()
	for (const match of content.matchAll(
		/https:\/\/steamcommunity\.com\/(?:sharedfiles|workshop)\/filedetails\/?\?[^\s<>]*/g,
	)) {
		try {
			const value = new URL(match[0].replace(/[)\],.!]+$/, '')).searchParams.get('id')
			if (value && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n)
				ids.add(BigInt(value))
		} catch {}
	}
	return [...ids]
}
const sourceKey = (row: Pick<SourceSubmission, 'messageId' | 'workshopId'>) =>
	`${row.messageId}:${row.workshopId}`
/** Prior supersession is sticky: deleting a newer submission never resurrects an older one. */
export function reconcileSources(messages: SourceMessage[], previous: readonly SourceSubmission[]) {
	const known = new Map(previous.map((row) => [sourceKey(row), row]))
	const rows: SourceSubmission[] = []
	for (const message of messages) {
		if (message.author.bot) continue
		const links = workshopLinks(message.content)
		for (const workshopId of links) {
			const row: SourceSubmission = {
				messageId: message.id,
				authorId: message.author.id,
				workshopId,
				messageCreatedAt: message.timestamp,
				messageEditedAt: message.edited_timestamp,
				state: 'selected',
				sourceError: links.length > 1 ? 'multiple-workshop-links' : null,
			}
			if (known.get(sourceKey(row))?.state === 'superseded') row.state = 'superseded'
			rows.push(row)
		}
	}
	const byAuthor = new Map<string, SourceSubmission[]>()
	for (const row of rows) {
		const group = byAuthor.get(row.authorId) ?? []
		group.push(row)
		byAuthor.set(row.authorId, group)
	}
	for (const group of byAuthor.values()) {
		group.sort((a, b) =>
			BigInt(a.messageId) > BigInt(b.messageId)
				? -1
				: BigInt(a.messageId) < BigInt(b.messageId)
					? 1
					: 0,
		)
		const latest = group.find((row) => row.state !== 'superseded')
		for (const row of group) {
			if (!latest || row.messageId !== latest.messageId) row.state = 'superseded'
		}
	}
	return rows
}
