import type { GhostGridModel, GhostPlaybackFrame, GhostVector3 } from '~/types/ghost'

const CELL_SIZE = 16 as const
const MAJOR_EVERY = 4 as const
const MARGIN = CELL_SIZE * MAJOR_EVERY
const MINIMUM_EXTENT = 256
const MINIMUM_LABEL_WORLD_OFFSET = 2.8
const LABEL_GAP_PIXELS = 12
const LABEL_STAGGER_PIXELS = 8

export function buildGhostGrid(paths: readonly (readonly GhostPlaybackFrame[])[]): GhostGridModel {
	const positions = paths.flatMap((frames) => frames.map(({ position }) => position))
	const bounds = calculateBounds(positions)
	const origin = {
		x: floorTo(bounds.center.x, CELL_SIZE),
		y: floorTo(bounds.minimum.y, CELL_SIZE),
		z: floorTo(bounds.center.z, CELL_SIZE),
	}
	const minimumX = floorTo(
		Math.min(bounds.minimum.x - origin.x - MARGIN, -MINIMUM_EXTENT / 2),
		CELL_SIZE,
	)
	const maximumX = ceilTo(
		Math.max(bounds.maximum.x - origin.x + MARGIN, MINIMUM_EXTENT / 2),
		CELL_SIZE,
	)
	const minimumZ = floorTo(
		Math.min(bounds.minimum.z - origin.z - MARGIN, -MINIMUM_EXTENT / 2),
		CELL_SIZE,
	)
	const maximumZ = ceilTo(
		Math.max(bounds.maximum.z - origin.z + MARGIN, MINIMUM_EXTENT / 2),
		CELL_SIZE,
	)
	const xLines = buildLines(minimumX, maximumX)
	const zLines = buildLines(minimumZ, maximumZ)
	return {
		cellSize: CELL_SIZE,
		majorEvery: MAJOR_EVERY,
		origin,
		minimumX,
		maximumX,
		minimumZ,
		maximumZ,
		minorX: xLines.minor,
		minorZ: zLines.minor,
		majorX: xLines.major,
		majorZ: zLines.major,
	}
}

export function rebaseGhostPosition(position: GhostVector3, origin: GhostVector3): GhostVector3 {
	return { x: position.x - origin.x, y: position.y - origin.y, z: -(position.z - origin.z) }
}

export function interpolateGhostFrame(
	frames: readonly GhostPlaybackFrame[],
	time: number,
): GhostPlaybackFrame | null {
	if (frames.length === 0) return null
	const first = frames[0]
	const last = frames.at(-1)
	if (!first || !last) return null
	if (time <= first.time) return first
	if (time >= last.time) return last
	let low = 0
	let high = frames.length - 1
	while (low + 1 < high) {
		const middle = Math.floor((low + high) / 2)
		if ((frames[middle]?.time ?? 0) <= time) low = middle
		else high = middle
	}
	const left = frames[low]
	const right = frames[high]
	if (!left || !right) return null
	const duration = right.time - left.time
	const ratio = duration > 0 ? Math.min(1, Math.max(0, (time - left.time) / duration)) : 0
	return {
		...left,
		time,
		position: {
			x: lerp(left.position.x, right.position.x, ratio),
			y: lerp(left.position.y, right.position.y, ratio),
			z: lerp(left.position.z, right.position.z, ratio),
		},
		speed:
			left.speed == null || right.speed == null
				? left.speed
				: lerp(left.speed, right.speed, ratio),
		steering:
			left.steering == null || right.steering == null
				? left.steering
				: lerp(left.steering, right.steering, ratio),
	}
}

export function perspectiveWorldUnitsPerPixel(
	distance: number,
	verticalFovDegrees: number,
	viewportHeight: number,
): number {
	if (distance <= 0 || verticalFovDegrees <= 0 || viewportHeight <= 0) return 0
	const verticalFovRadians = (verticalFovDegrees * Math.PI) / 180
	return (2 * distance * Math.tan(verticalFovRadians / 2)) / viewportHeight
}

export function orthographicWorldUnitsPerPixel(
	verticalSpan: number,
	zoom: number,
	viewportHeight: number,
): number {
	if (verticalSpan <= 0 || zoom <= 0 || viewportHeight <= 0) return 0
	return verticalSpan / zoom / viewportHeight
}

export function calculateGhostLabelWorldOffset(
	worldUnitsPerPixel: number,
	labelHeight: number,
	staggerIndex: number,
): number {
	const clearancePixels =
		Math.max(0, labelHeight) / 2 +
		LABEL_GAP_PIXELS +
		Math.max(0, staggerIndex) * LABEL_STAGGER_PIXELS
	return Math.max(MINIMUM_LABEL_WORLD_OFFSET, Math.max(0, worldUnitsPerPixel) * clearancePixels)
}

function calculateBounds(positions: readonly GhostVector3[]) {
	if (positions.length === 0) {
		return {
			minimum: { x: 0, y: 0, z: 0 },
			maximum: { x: 0, y: 0, z: 0 },
			center: { x: 0, y: 0, z: 0 },
		}
	}
	const minimum = {
		x: Number.POSITIVE_INFINITY,
		y: Number.POSITIVE_INFINITY,
		z: Number.POSITIVE_INFINITY,
	}
	const maximum = {
		x: Number.NEGATIVE_INFINITY,
		y: Number.NEGATIVE_INFINITY,
		z: Number.NEGATIVE_INFINITY,
	}
	for (const position of positions) {
		minimum.x = Math.min(minimum.x, position.x)
		minimum.y = Math.min(minimum.y, position.y)
		minimum.z = Math.min(minimum.z, position.z)
		maximum.x = Math.max(maximum.x, position.x)
		maximum.y = Math.max(maximum.y, position.y)
		maximum.z = Math.max(maximum.z, position.z)
	}
	return {
		minimum,
		maximum,
		center: {
			x: (minimum.x + maximum.x) / 2,
			y: (minimum.y + maximum.y) / 2,
			z: (minimum.z + maximum.z) / 2,
		},
	}
}

function buildLines(minimum: number, maximum: number) {
	const minor: number[] = []
	const major: number[] = []
	for (let value = minimum; value <= maximum; value += CELL_SIZE) {
		if (Math.round(value / CELL_SIZE) % MAJOR_EVERY === 0) major.push(value)
		else minor.push(value)
	}
	return { minor, major }
}

function floorTo(value: number, step: number) {
	return Math.floor(value / step) * step
}

function ceilTo(value: number, step: number) {
	return Math.ceil(value / step) * step
}

function lerp(start: number, end: number, ratio: number) {
	return start + (end - start) * ratio
}
