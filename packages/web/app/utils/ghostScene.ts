import type { GhostGridModel, GhostPlaybackFrame, GhostVector3 } from '~/types/ghost'

const CELL_SIZE = 16 as const
const MAJOR_EVERY = 4 as const
const MARGIN = CELL_SIZE * MAJOR_EVERY
const MINIMUM_EXTENT = 256
const MINIMUM_LABEL_WORLD_OFFSET = 4.5
const LABEL_GAP_PIXELS = 24
const LABEL_STAGGER_PIXELS = 10
const MINIMUM_ISOMETRIC_CAMERA_DISTANCE = 80
const ISOMETRIC_CAMERA_DEPTH_MARGIN = 80
const DEFAULT_CAMERA_FAR = 5_000
const FRAME_INTERVAL_EPSILON_MS = 0.01

export type GhostSceneQuality = 'performance' | 'balanced' | 'quality'

export type GhostRendererOptions = {
	antialias: boolean
	powerPreference: 'low-power' | 'high-performance'
	stencil: false
}

export type GhostVisualDescriptor = {
	recordId: number
	revision: string
}

export type GhostVisualReconciliation = {
	create: GhostVisualDescriptor[]
	remove: number[]
	retain: number[]
}

const GHOST_TRAIL_TOTAL_BUDGET: Record<GhostSceneQuality, number> = {
	performance: 25_000,
	balanced: 60_000,
	quality: 120_000,
}

const GHOST_TRAIL_PER_GHOST_CAP: Record<GhostSceneQuality, number> = {
	performance: 2_000,
	balanced: 6_000,
	quality: 15_000,
}

const GHOST_TRAIL_SIMPLIFICATION_TOLERANCE: Record<GhostSceneQuality, number> = {
	performance: 0.25,
	balanced: 0.1,
	quality: 0.04,
}

const GHOST_TRAIL_MAXIMUM_TIME_STEP: Record<GhostSceneQuality, number> = {
	performance: 1,
	balanced: 0.5,
	quality: 0.25,
}

const MINIMUM_GHOST_TRAIL_SAMPLES = 2

export type GhostFrameTiming = {
	frameDue: boolean
	framePhase: number | null
}

export function resolveGhostRendererOptions(quality: GhostSceneQuality): GhostRendererOptions {
	return {
		antialias: quality !== 'performance',
		powerPreference: quality === 'quality' ? 'high-performance' : 'low-power',
		stencil: false,
	}
}

export function resolveGhostTrailSampleLimit(
	quality: GhostSceneQuality,
	ghostCount: number,
	bulkMode: boolean,
): number {
	const perGhostCap = GHOST_TRAIL_PER_GHOST_CAP[quality]
	if (!bulkMode) return perGhostCap
	const safeGhostCount = Math.max(1, Math.floor(ghostCount))
	return Math.min(
		perGhostCap,
		Math.max(
			MINIMUM_GHOST_TRAIL_SAMPLES,
			Math.floor(GHOST_TRAIL_TOTAL_BUDGET[quality] / safeGhostCount),
		),
	)
}

export function resolveGhostTrailSimplificationTolerance(quality: GhostSceneQuality): number {
	return GHOST_TRAIL_SIMPLIFICATION_TOLERANCE[quality]
}

export function resolveGhostFrameTiming(
	previousFramePhase: number | null,
	timestamp: number,
	frameRate: 30 | 60,
): GhostFrameTiming {
	if (previousFramePhase === null || timestamp + FRAME_INTERVAL_EPSILON_MS < previousFramePhase) {
		return { frameDue: true, framePhase: timestamp }
	}
	const interval = 1_000 / frameRate
	const elapsed = timestamp - previousFramePhase
	if (elapsed + FRAME_INTERVAL_EPSILON_MS < interval) {
		return { frameDue: false, framePhase: previousFramePhase }
	}
	const elapsedIntervals = Math.max(
		1,
		Math.floor((elapsed + FRAME_INTERVAL_EPSILON_MS) / interval),
	)
	return { frameDue: true, framePhase: previousFramePhase + elapsedIntervals * interval }
}

export function sampleGhostTrailFrames<T>(frames: readonly T[], maximum: number): T[] {
	const sampleCount = Math.min(frames.length, Math.max(0, Math.floor(maximum)))
	if (sampleCount === 0) return []
	if (sampleCount === 1) return [frames[0] as T]
	return Array.from({ length: sampleCount }, (_, sampleIndex) => {
		const index = Math.round((sampleIndex * (frames.length - 1)) / (sampleCount - 1))
		return frames[index] as T
	})
}

export function simplifyGhostTrailFrames(
	frames: readonly GhostPlaybackFrame[],
	quality: GhostSceneQuality,
	maximum: number,
): GhostPlaybackFrame[] {
	const cap = Math.min(frames.length, Math.max(0, Math.floor(maximum)))
	if (cap === 0) return []
	if (cap === 1) return frames[0] ? [frames[0]] : []
	if (frames.length <= 2) return [...frames]

	const minimumTolerance = resolveGhostTrailSimplificationTolerance(quality)
	let simplified = simplifyGhostTrailFramesAtTolerance(frames, minimumTolerance)
	if (simplified.length <= cap) {
		return preserveGhostTrailProgress(frames, simplified, quality, cap)
	}

	let lowerTolerance = minimumTolerance
	let upperTolerance = Math.max(minimumTolerance * 2, ghostTrailBoundsDiagonal(frames))
	let upperResult = simplifyGhostTrailFramesAtTolerance(frames, upperTolerance)
	while (upperResult.length > cap && Number.isFinite(upperTolerance)) {
		lowerTolerance = upperTolerance
		upperTolerance *= 2
		upperResult = simplifyGhostTrailFramesAtTolerance(frames, upperTolerance)
	}

	for (let iteration = 0; iteration < 16; iteration += 1) {
		const tolerance = (lowerTolerance + upperTolerance) / 2
		const candidate = simplifyGhostTrailFramesAtTolerance(frames, tolerance)
		if (candidate.length > cap) lowerTolerance = tolerance
		else {
			upperTolerance = tolerance
			upperResult = candidate
		}
	}

	simplified = upperResult
	const capped = simplified.length <= cap ? simplified : sampleGhostTrailFrames(simplified, cap)
	return preserveGhostTrailProgress(frames, capped, quality, cap)
}

function preserveGhostTrailProgress(
	frames: readonly GhostPlaybackFrame[],
	spatialFrames: readonly GhostPlaybackFrame[],
	quality: GhostSceneQuality,
	cap: number,
): GhostPlaybackFrame[] {
	if (spatialFrames.length >= cap) return [...spatialFrames]
	const indexByFrame = new Map(frames.map((frame, index) => [frame, index]))
	const retainedIndices = new Set(
		spatialFrames.flatMap((frame) => {
			const index = indexByFrame.get(frame)
			return index === undefined ? [] : [index]
		}),
	)
	const temporalIndices: number[] = []
	const firstTime = frames[0]?.time ?? 0
	const maximumTimeStep = GHOST_TRAIL_MAXIMUM_TIME_STEP[quality]
	let nextTime = firstTime + maximumTimeStep
	for (let index = 1; index < frames.length - 1; index += 1) {
		const frame = frames[index]
		if (!frame || frame.time < nextTime) continue
		if (!retainedIndices.has(index)) temporalIndices.push(index)
		nextTime = frame.time + maximumTimeStep
	}

	const available = cap - retainedIndices.size
	const selectedTemporalIndices =
		temporalIndices.length <= available
			? temporalIndices
			: sampleGhostTrailFrames(temporalIndices, available)
	for (const index of selectedTemporalIndices) retainedIndices.add(index)
	return [...retainedIndices]
		.toSorted((left, right) => left - right)
		.flatMap((index) => (frames[index] ? [frames[index]] : []))
}

function simplifyGhostTrailFramesAtTolerance(
	frames: readonly GhostPlaybackFrame[],
	tolerance: number,
): GhostPlaybackFrame[] {
	const lastIndex = frames.length - 1
	if (lastIndex < 1) return [...frames]
	const retained = new Uint8Array(frames.length)
	retained[0] = 1
	retained[lastIndex] = 1
	const stack: Array<[number, number]> = [[0, lastIndex]]
	const toleranceSquared = tolerance * tolerance

	while (stack.length > 0) {
		const range = stack.pop()
		if (!range) continue
		const [startIndex, endIndex] = range
		const start = frames[startIndex]
		const end = frames[endIndex]
		if (!start || !end) continue
		const startPosition = resolveGhostDisplayPosition(start)
		const endPosition = resolveGhostDisplayPosition(end)
		let furthestIndex = -1
		let furthestDistanceSquared = toleranceSquared

		for (let index = startIndex + 1; index < endIndex; index += 1) {
			const frame = frames[index]
			if (!frame) continue
			const distanceSquared = pointSegmentDistanceSquared(
				resolveGhostDisplayPosition(frame),
				startPosition,
				endPosition,
			)
			if (distanceSquared > furthestDistanceSquared) {
				furthestDistanceSquared = distanceSquared
				furthestIndex = index
			}
		}

		if (furthestIndex < 0) continue
		retained[furthestIndex] = 1
		stack.push([startIndex, furthestIndex], [furthestIndex, endIndex])
	}

	return frames.filter((_, index) => retained[index] === 1)
}

function pointSegmentDistanceSquared(
	point: GhostVector3,
	start: GhostVector3,
	end: GhostVector3,
): number {
	const lineX = end.x - start.x
	const lineY = end.y - start.y
	const lineZ = end.z - start.z
	const lengthSquared = lineX * lineX + lineY * lineY + lineZ * lineZ
	if (lengthSquared === 0) return vectorDistanceSquared(point, start)
	const ratio = Math.min(
		1,
		Math.max(
			0,
			((point.x - start.x) * lineX +
				(point.y - start.y) * lineY +
				(point.z - start.z) * lineZ) /
				lengthSquared,
		),
	)
	const projected = {
		x: start.x + lineX * ratio,
		y: start.y + lineY * ratio,
		z: start.z + lineZ * ratio,
	}
	return vectorDistanceSquared(point, projected)
}

function vectorDistanceSquared(left: GhostVector3, right: GhostVector3): number {
	const x = left.x - right.x
	const y = left.y - right.y
	const z = left.z - right.z
	return x * x + y * y + z * z
}

function ghostTrailBoundsDiagonal(frames: readonly GhostPlaybackFrame[]): number {
	let minimumX = Number.POSITIVE_INFINITY
	let minimumY = Number.POSITIVE_INFINITY
	let minimumZ = Number.POSITIVE_INFINITY
	let maximumX = Number.NEGATIVE_INFINITY
	let maximumY = Number.NEGATIVE_INFINITY
	let maximumZ = Number.NEGATIVE_INFINITY
	for (const frame of frames) {
		const position = resolveGhostDisplayPosition(frame)
		minimumX = Math.min(minimumX, position.x)
		minimumY = Math.min(minimumY, position.y)
		minimumZ = Math.min(minimumZ, position.z)
		maximumX = Math.max(maximumX, position.x)
		maximumY = Math.max(maximumY, position.y)
		maximumZ = Math.max(maximumZ, position.z)
	}
	return Math.hypot(maximumX - minimumX, maximumY - minimumY, maximumZ - minimumZ)
}

export function planGhostVisualReconciliation(
	existing: readonly GhostVisualDescriptor[],
	desired: readonly GhostVisualDescriptor[],
): GhostVisualReconciliation {
	const existingById = new Map(existing.map((item) => [item.recordId, item]))
	const desiredIds = new Set(desired.map(({ recordId }) => recordId))
	const remove = existing
		.filter((item) => !desiredIds.has(item.recordId))
		.map(({ recordId }) => recordId)
	const create: GhostVisualDescriptor[] = []
	const retain: number[] = []

	for (const item of desired) {
		const current = existingById.get(item.recordId)
		if (!current || current.revision !== item.revision) {
			create.push(item)
			if (current) remove.push(item.recordId)
		} else retain.push(item.recordId)
	}

	return { create, remove, retain }
}

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
		routeMinimum: {
			x: bounds.minimum.x - origin.x,
			y: bounds.minimum.y - origin.y,
			z: -(bounds.maximum.z - origin.z),
		},
		routeMaximum: {
			x: bounds.maximum.x - origin.x,
			y: bounds.maximum.y - origin.y,
			z: -(bounds.minimum.z - origin.z),
		},
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

export function calculateIsometricCameraDepth(model: GhostGridModel) {
	const projectedDepth =
		(model.routeMaximum.x -
			model.routeMinimum.x +
			(model.routeMaximum.y - model.routeMinimum.y) +
			(model.routeMaximum.z - model.routeMinimum.z)) /
		Math.sqrt(3)
	const distance = Math.max(
		MINIMUM_ISOMETRIC_CAMERA_DISTANCE,
		projectedDepth + ISOMETRIC_CAMERA_DEPTH_MARGIN,
	)
	return {
		distance,
		far: Math.max(
			DEFAULT_CAMERA_FAR,
			distance + projectedDepth + ISOMETRIC_CAMERA_DEPTH_MARGIN,
		),
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
		ragdollPosition:
			left.ragdollPosition == null || right.ragdollPosition == null
				? left.ragdollPosition
				: lerpVector3(left.ragdollPosition, right.ragdollPosition, ratio),
	}
}

export function resolveGhostDisplayPosition(frame: GhostPlaybackFrame): GhostVector3 {
	return frame.ragdoll === true && frame.ragdollPosition != null
		? frame.ragdollPosition
		: frame.position
}

export function resolveGhostPlaybackStartTime(currentTime: number, duration: number): number {
	const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
	const safeCurrentTime = Number.isFinite(currentTime)
		? Math.min(safeDuration, Math.max(0, currentTime))
		: 0
	return safeCurrentTime >= safeDuration - 0.0005 ? 0 : safeCurrentTime
}

export function resolveGhostSelectedRecordId(
	currentRecordId: number | null,
	primaryRecordId: number | null | undefined,
	loadedRecordIds: readonly number[],
	primaryFailed: boolean,
): number | null {
	if (currentRecordId !== null && loadedRecordIds.includes(currentRecordId)) {
		return currentRecordId
	}
	if (primaryRecordId !== null && primaryRecordId !== undefined && !primaryFailed) {
		return primaryRecordId
	}
	return loadedRecordIds[0] ?? null
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

function lerpVector3(start: GhostVector3, end: GhostVector3, ratio: number): GhostVector3 {
	return {
		x: lerp(start.x, end.x, ratio),
		y: lerp(start.y, end.y, ratio),
		z: lerp(start.z, end.z, ratio),
	}
}
