const checkpointIds = new Set([22, 372, 373, 1275, 1276, 1277, 1278, 1279, 1615])
const alternateCheckpointIds = new Set([
	1609, 1610, 1613, 1614, 1979, 1981, 1983, 1985, 1607, 1608, 1611, 1612, 1978, 1980, 1982, 1984,
	1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
])
const finishIds = new Set([2, 1273, 1274, 1412, 1616])

export function countCheckpoints(blocks: Array<{ id: number; isCheckpoint?: boolean }>): number {
	return blocks.reduce((total, block) => {
		if (checkpointIds.has(block.id)) {
			return total + 1
		}
		return total + (alternateCheckpointIds.has(block.id) && block.isCheckpoint ? 1 : 0)
	}, 0)
}

export function countFinishes(blocks: Array<{ id: number }>): number {
	return blocks.reduce((total, block) => total + (finishIds.has(block.id) ? 1 : 0), 0)
}

/** Connected checkpoint components. Inactive gate nodes can join active members. */
export function countJsonCheckpointGroups(blocks: Array<Record<string, unknown>>): number {
	const nodes = new Map<string, { block: Record<string, unknown>; active: boolean }>()
	for (const [index, block] of blocks.entries()) {
		const id = Number(block.i)
		if (!checkpointIds.has(id) && !alternateCheckpointIds.has(id)) continue
		const data = block.d as { n?: Record<string, unknown> } | undefined
		nodes.set(typeof block.u === 'string' ? block.u : `missing:${index}`, {
			block,
			active: checkpointIds.has(id) || data?.n?.ch5 === 1,
		})
	}
	const edges = new Map<string, Set<string>>()
	let budget = 100000
	for (const [uid, { block }] of nodes) {
		const data = block.d as
			| { n?: Record<string, unknown>; t?: Record<string, unknown> }
			| undefined
		const count = Number(data?.n?.id0 ?? 0)
		if (!Number.isInteger(count) || count < 0 || count > 20000 || count > budget) continue
		budget -= count
		for (let index = 0; index < count; index++) {
			const text = data?.t?.[`id0-${index}`]
			if (typeof text !== 'string') continue
			try {
				const link = JSON.parse(text) as { t?: string; c?: number }
				if (link?.c !== 0 || typeof link.t !== 'string' || !nodes.has(link.t)) continue
				for (const [from, to] of [
					[uid, link.t],
					[link.t, uid],
				] as const) {
					const targets = edges.get(from) ?? new Set<string>()
					targets.add(to)
					edges.set(from, targets)
				}
			} catch {
				/* Malformed links cannot merge checkpoint groups. */
			}
		}
	}
	const visited = new Set<string>()
	let count = 0
	for (const uid of nodes.keys()) {
		if (visited.has(uid)) continue
		const pending = [uid]
		let active = false
		while (pending.length) {
			const current = pending.pop()
			if (current === undefined) break
			if (visited.has(current)) continue
			visited.add(current)
			active ||= nodes.get(current)?.active ?? false
			pending.push(...(edges.get(current) ?? []))
		}
		if (active) count++
	}
	return count
}
