import type { GhostLevelBlock, GhostVector3 } from '~/types/ghost'

const MAXIMUM_RENDER_BLOCKS = 20_000

export function parseLevelGeometryBlocks(value: unknown): GhostLevelBlock[] {
	if (!Array.isArray(value)) return []
	return value.slice(0, MAXIMUM_RENDER_BLOCKS).flatMap((entry) => {
		if (!entry || typeof entry !== 'object') return []
		const block = entry as Record<string, unknown>
		const position = readVector(
			block.Position ?? block.position ?? block.p ?? nested(block, 'd', 'p'),
		)
		if (!position) return []
		return [
			{
				id: readNumber(block.Id ?? block.id ?? block.i),
				position,
				rotation: readVector(
					block.Euler ??
						block.euler ??
						block.rotation ??
						block.r ??
						nested(block, 'd', 'r'),
				) ?? { x: 0, y: 0, z: 0 },
				scale: readVector(
					block.Scale ?? block.scale ?? block.s ?? nested(block, 'd', 's'),
				) ?? { x: 1, y: 1, z: 1 },
			},
		]
	})
}

function nested(value: Record<string, unknown>, first: string, second: string): unknown {
	const parent = value[first]
	return parent && typeof parent === 'object'
		? (parent as Record<string, unknown>)[second]
		: undefined
}

function readVector(value: unknown): GhostVector3 | null {
	if (Array.isArray(value)) {
		const x = readNumber(value[0])
		const y = readNumber(value[1])
		const z = readNumber(value[2])
		return x === null || y === null || z === null ? null : { x, y, z }
	}
	if (!value || typeof value !== 'object') return null
	const vector = value as Record<string, unknown>
	const x = readNumber(vector.X ?? vector.x)
	const y = readNumber(vector.Y ?? vector.y)
	const z = readNumber(vector.Z ?? vector.z)
	return x === null || y === null || z === null ? null : { x, y, z }
}

function readNumber(value: unknown): number | null {
	const parsed = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(parsed) ? parsed : null
}
