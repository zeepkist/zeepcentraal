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
