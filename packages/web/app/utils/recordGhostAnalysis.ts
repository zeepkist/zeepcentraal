import type {
	GhostEventKind,
	GhostPlaybackFrame,
	GhostSlipEvent,
	GhostTimelineEvent,
	LoadedPlaybackGhost,
	ParsedPlaybackGhost,
} from '~/types/ghost'
import { buildGhostSlipEvents, buildGhostTimelineEvents, pathDistance } from './ghostAnalysis'

export type RecordTelemetryMetricKey =
	| 'speed'
	| 'steering'
	| 'lateral-velocity'
	| 'longitudinal-velocity'
	| 'angular-velocity'
	| 'g-force'

export type RecordAnalysisSeries = {
	key: string
	recordId: number
	label: string
	color: string
	dashed: boolean
}

export type RecordTelemetryChartData = {
	key: RecordTelemetryMetricKey
	data: Array<Record<string, number>>
	series: RecordAnalysisSeries[]
}

export type RecordAnalysisFrameSource = {
	key: string
	recordId: number
	label: string
	color: string
	dashed: boolean
	frames: readonly GhostPlaybackFrame[]
}

export type RecordTimelineLane = {
	kind: GhostEventKind
	events: GhostTimelineEvent[]
}

export type RecordDriftRun = {
	recordId: number
	label: string
	color: string
	dashed: boolean
	events: GhostSlipEvent[]
	eventCount: number
	totalDuration: number
	totalDistance: number
	averageSpeedRetention: number | null
	worstSpeedRetention: number | null
}

export type RecordAnalysisSummary = {
	recordId: number
	duration: number
	distance: number
	maximumSpeed: number | null
	averageSpeed: number | null
	eventCount: number
	driftCount: number
	driftDuration: number
}

export type RecordCoachingSignalKind =
	| 'strong-speed-retention'
	| 'drift-speed-loss'
	| 'long-drift'
	| 'late-braking'
	| 'low-input-section'
	| 'comparison-speed-deficit'

export type RecordCoachingSignal = {
	id: string
	kind: RecordCoachingSignalKind
	tone: 'positive' | 'warning' | 'info'
	start: number
	end: number
	value: number
	comparisonValue: number | null
}

const METRIC_RESOLVERS: Record<
	RecordTelemetryMetricKey,
	(frame: GhostPlaybackFrame) => number | null
> = {
	speed: (frame) => finiteOrNull(frame.speed),
	steering: (frame) => finiteOrNull(frame.steering),
	'lateral-velocity': (frame) => finiteOrNull(frame.localVelocity?.x),
	'longitudinal-velocity': (frame) => finiteOrNull(frame.localVelocity?.z),
	'angular-velocity': (frame) => vectorMagnitude(frame.localAngularVelocity),
	'g-force': (frame) => vectorMagnitude(frame.localGForce),
}

export function buildRecordTelemetryCharts(
	ghosts: readonly LoadedPlaybackGhost[],
	maximumPoints = 600,
): RecordTelemetryChartData[] {
	return buildRecordTelemetryChartsFromSources(
		ghosts.map((ghost) => ({
			...toAnalysisSeries(ghost),
			frames: ghost.ghost.frames,
		})),
		maximumPoints,
	)
}

export function buildRecordTelemetryChartsFromSources(
	sources: readonly RecordAnalysisFrameSource[],
	maximumPoints = 600,
): RecordTelemetryChartData[] {
	const series = sources.map(({ frames: _frames, ...entry }) => entry)
	return (Object.keys(METRIC_RESOLVERS) as RecordTelemetryMetricKey[]).map((key) => ({
		key,
		series: series.filter((entry) =>
			sources.some(
				(source) =>
					source.key === entry.key &&
					source.frames.some((frame) => METRIC_RESOLVERS[key](frame) !== null),
			),
		),
		data: buildMetricData(sources, METRIC_RESOLVERS[key], maximumPoints),
	}))
}

export function buildRecordTimelineLanes(
	frames: readonly GhostPlaybackFrame[],
): RecordTimelineLane[] {
	const groups = new Map<GhostEventKind, GhostTimelineEvent[]>()
	for (const event of buildGhostTimelineEvents(frames)) {
		const events = groups.get(event.kind) ?? []
		events.push(event)
		groups.set(event.kind, events)
	}
	return [...groups.entries()].map(([kind, events]) => ({ kind, events }))
}

export function buildRecordDriftRuns(ghosts: readonly LoadedPlaybackGhost[]): RecordDriftRun[] {
	return ghosts.map((ghost) => {
		const events = buildGhostSlipEvents(ghost.ghost.frames)
		const retentionValues = events.flatMap((event) =>
			event.speedRetention === null ? [] : [event.speedRetention],
		)
		return {
			...toAnalysisSeries(ghost),
			events,
			eventCount: events.length,
			totalDuration: events.reduce((total, event) => total + event.duration, 0),
			totalDistance: events.reduce((total, event) => total + event.distance, 0),
			averageSpeedRetention:
				retentionValues.length > 0
					? retentionValues.reduce((total, value) => total + value, 0) /
						retentionValues.length
					: null,
			worstSpeedRetention: retentionValues.length > 0 ? Math.min(...retentionValues) : null,
		}
	})
}

export function buildRecordAnalysisSummary(ghost: LoadedPlaybackGhost): RecordAnalysisSummary {
	const frames = ghost.ghost.frames
	const speeds = frames.flatMap((frame) =>
		Number.isFinite(frame.speed) ? [frame.speed as number] : [],
	)
	const events = buildGhostTimelineEvents(frames)
	const drifts = buildGhostSlipEvents(frames)
	return {
		recordId: ghost.record.recordId,
		duration: frames.at(-1)?.time ?? ghost.record.time,
		distance: pathDistance(frames),
		maximumSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
		averageSpeed:
			speeds.length > 0
				? speeds.reduce((total, value) => total + value, 0) / speeds.length
				: null,
		eventCount: events.length,
		driftCount: drifts.length,
		driftDuration: drifts.reduce((total, event) => total + event.duration, 0),
	}
}

export function buildRecordCoachingSignals(
	primary: LoadedPlaybackGhost,
	comparison?: LoadedPlaybackGhost | null,
): RecordCoachingSignal[] {
	const signals: RecordCoachingSignal[] = []
	const frames = primary.ghost.frames
	const drifts = buildGhostSlipEvents(frames)
	for (const event of drifts) {
		if (
			event.speedRetention !== null &&
			event.speedRetention >= 0.96 &&
			event.duration >= 0.25
		) {
			signals.push({
				id: `strong-retention-${event.id}`,
				kind: 'strong-speed-retention',
				tone: 'positive',
				start: event.start,
				end: event.end,
				value: event.speedRetention,
				comparisonValue: null,
			})
		} else if (event.speedRetention !== null && event.speedRetention < 0.85) {
			signals.push({
				id: `drift-loss-${event.id}`,
				kind: 'drift-speed-loss',
				tone: 'warning',
				start: event.start,
				end: event.end,
				value: event.speedRetention,
				comparisonValue: null,
			})
		}
		if (event.duration >= 2) {
			signals.push({
				id: `long-drift-${event.id}`,
				kind: 'long-drift',
				tone: 'info',
				start: event.start,
				end: event.end,
				value: event.duration,
				comparisonValue: null,
			})
		}
	}

	for (const event of buildGhostTimelineEvents(frames).filter(
		(entry) => entry.kind === 'braking',
	)) {
		const startFrame = frames[event.startFrame]
		if ((startFrame?.speed ?? 0) >= 80 && event.duration >= 0.35) {
			signals.push({
				id: `braking-${event.id}`,
				kind: 'late-braking',
				tone: 'info',
				start: event.start,
				end: event.end,
				value: startFrame?.speed ?? 0,
				comparisonValue: null,
			})
		}
	}
	for (const section of buildLowInputSections(frames)) {
		signals.push({
			id: `low-input-${section.start.toFixed(2)}`,
			kind: 'low-input-section',
			tone: 'info',
			start: section.start,
			end: section.end,
			value: section.end - section.start,
			comparisonValue: null,
		})
	}

	if (comparison) signals.push(...buildComparisonSpeedSignals(primary, comparison))
	return signals.toSorted(
		(left, right) => left.start - right.start || left.id.localeCompare(right.id),
	)
}

export function buildRecordCoachingInsights(
	primary: ParsedPlaybackGhost,
	comparisons: readonly LoadedPlaybackGhost[],
): RecordCoachingSignal[] {
	const primarySource = createAnalysisOnlyGhost(primary)
	const fastestComparison = comparisons.toSorted(
		(left, right) =>
			left.record.time - right.record.time || left.record.recordId - right.record.recordId,
	)[0]
	return buildRecordCoachingSignals(primarySource, fastestComparison ?? null)
}

function buildMetricData(
	sources: readonly RecordAnalysisFrameSource[],
	resolveValue: (frame: GhostPlaybackFrame) => number | null,
	maximumPoints: number,
): Array<Record<string, number>> {
	const maximumDuration = Math.max(0, ...sources.map((source) => source.frames.at(-1)?.time ?? 0))
	if (maximumDuration <= 0 || maximumPoints <= 0) return []
	const frameCount = Math.max(2, Math.min(maximumPoints, Math.ceil(maximumDuration * 10) + 1))
	return Array.from({ length: frameCount }, (_, index) => {
		const elapsed = (index / (frameCount - 1)) * maximumDuration
		const point: Record<string, number> = { elapsed }
		for (const source of sources) {
			const value = sampleMetric(source.frames, elapsed, resolveValue)
			if (value !== null) point[source.key] = value
		}
		return point
	})
}

function createAnalysisOnlyGhost(ghost: ParsedPlaybackGhost): LoadedPlaybackGhost {
	return {
		record: {
			recordId: 0,
			levelId: 0,
			userId: 0,
			userSteamId: null,
			userName: null,
			time: ghost.frames.at(-1)?.time ?? 0,
			dateCreated: '',
			ghostUrl: null,
			mediaRevision: null,
			isWorldRecord: false,
			isPersonalBest: false,
		},
		ghost,
		identity: {
			recordId: 0,
			userKey: 'primary',
			playerName: '',
			label: '',
			isWorldRecord: false,
			isPersonalBest: false,
			userRunOrdinal: null,
			bodyColor: '#facc15',
			colorSource: 'fallback',
		},
	}
}

function sampleMetric(
	frames: readonly GhostPlaybackFrame[],
	time: number,
	resolveValue: (frame: GhostPlaybackFrame) => number | null,
): number | null {
	if (frames.length === 0 || time > (frames.at(-1)?.time ?? 0)) return null
	let low = 0
	let high = frames.length - 1
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if ((frames[middle]?.time ?? 0) < time) low = middle + 1
		else high = middle
	}
	const next = frames[low]
	const previous = frames[Math.max(0, low - 1)]
	if (!next || !previous) return null
	const previousValue = resolveValue(previous)
	const nextValue = resolveValue(next)
	if (previousValue === null) return nextValue
	if (nextValue === null) return previousValue
	const duration = next.time - previous.time
	if (duration <= 0) return nextValue
	const ratio = Math.max(0, Math.min(1, (time - previous.time) / duration))
	return previousValue + (nextValue - previousValue) * ratio
}

function buildComparisonSpeedSignals(
	primary: LoadedPlaybackGhost,
	comparison: LoadedPlaybackGhost,
): RecordCoachingSignal[] {
	const primaryFrames = primary.ghost.frames
	const comparisonFrames = comparison.ghost.frames
	const duration = Math.min(primaryFrames.at(-1)?.time ?? 0, comparisonFrames.at(-1)?.time ?? 0)
	const primaryDistances = cumulativeDistances(primaryFrames)
	const comparisonDistances = cumulativeDistances(comparisonFrames)
	const primaryDistance = primaryDistances.at(-1) ?? 0
	const comparisonDistance = comparisonDistances.at(-1) ?? 0
	if (primaryDistance <= 0 || comparisonDistance <= 0) return []
	const signals: RecordCoachingSignal[] = []
	let start: number | null = null
	let totalDeficit = 0
	let samples = 0
	for (let time = 0; time <= duration; time += 0.25) {
		const primarySpeed = sampleMetric(primaryFrames, time, METRIC_RESOLVERS.speed)
		const distance = sampleMetricByTime(primaryFrames, primaryDistances, time)
		const progress = distance / primaryDistance
		const comparisonSpeed = sampleMetricByDistance(
			comparisonFrames,
			comparisonDistances,
			progress * comparisonDistance,
			METRIC_RESOLVERS.speed,
		)
		const deficit =
			primarySpeed !== null && comparisonSpeed !== null ? comparisonSpeed - primarySpeed : 0
		if (deficit >= 5) {
			start ??= time
			totalDeficit += deficit
			samples++
			continue
		}
		if (start !== null && time - start >= 1) {
			signals.push({
				id: `speed-deficit-${start.toFixed(2)}`,
				kind: 'comparison-speed-deficit',
				tone: 'warning',
				start,
				end: time,
				value: totalDeficit / Math.max(samples, 1),
				comparisonValue: comparison.record.recordId,
			})
		}
		start = null
		totalDeficit = 0
		samples = 0
	}
	if (start !== null && duration - start >= 1) {
		signals.push({
			id: `speed-deficit-${start.toFixed(2)}`,
			kind: 'comparison-speed-deficit',
			tone: 'warning',
			start,
			end: duration,
			value: totalDeficit / Math.max(samples, 1),
			comparisonValue: comparison.record.recordId,
		})
	}
	return signals
}

function cumulativeDistances(frames: readonly GhostPlaybackFrame[]) {
	const distances = new Array<number>(frames.length).fill(0)
	for (let index = 1; index < frames.length; index++) {
		const previous = frames[index - 1]?.position
		const current = frames[index]?.position
		if (!previous || !current) continue
		distances[index] =
			(distances[index - 1] ?? 0) +
			Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z)
	}
	return distances
}

function sampleMetricByTime(
	frames: readonly GhostPlaybackFrame[],
	values: readonly number[],
	time: number,
) {
	return sampleIndexedValue(
		frames.map((frame) => frame.time),
		values,
		time,
	)
}

function sampleMetricByDistance(
	frames: readonly GhostPlaybackFrame[],
	distances: readonly number[],
	distance: number,
	resolveValue: (frame: GhostPlaybackFrame) => number | null,
) {
	const values = frames.map(resolveValue)
	return sampleIndexedValue(distances, values, distance)
}

function sampleIndexedValue(
	keys: readonly number[],
	values: readonly (number | null)[],
	target: number,
): number {
	if (keys.length === 0) return 0
	let low = 0
	let high = keys.length - 1
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if ((keys[middle] ?? 0) < target) low = middle + 1
		else high = middle
	}
	const rightIndex = low
	const leftIndex = Math.max(0, rightIndex - 1)
	const leftKey = keys[leftIndex] ?? 0
	const rightKey = keys[rightIndex] ?? leftKey
	const leftValue = values[leftIndex] ?? values[rightIndex] ?? 0
	const rightValue = values[rightIndex] ?? leftValue
	const ratio =
		rightKey > leftKey ? Math.max(0, Math.min(1, (target - leftKey) / (rightKey - leftKey))) : 0
	return leftValue + (rightValue - leftValue) * ratio
}

function toAnalysisSeries(ghost: LoadedPlaybackGhost): RecordAnalysisSeries {
	return {
		key: `record-${ghost.record.recordId}`,
		recordId: ghost.record.recordId,
		label: ghost.identity.label,
		color: ghost.identity.bodyColor,
		dashed: (ghost.identity.userRunOrdinal ?? 0) > 1,
	}
}

function buildLowInputSections(frames: readonly GhostPlaybackFrame[]) {
	const sections: Array<{ start: number; end: number }> = []
	let start: number | null = null
	for (const frame of frames) {
		const passive =
			Math.abs(frame.steering ?? 0) <= 0.01 &&
			frame.armsUp !== true &&
			frame.braking !== true &&
			(frame.speed ?? 0) >= 20
		if (passive) {
			start ??= frame.time
			continue
		}
		if (start !== null && frame.time - start >= 2) sections.push({ start, end: frame.time })
		start = null
	}
	const end = frames.at(-1)?.time ?? 0
	if (start !== null && end - start >= 2) sections.push({ start, end })
	return sections
}

function vectorMagnitude(value?: { x: number; y: number; z?: number } | null) {
	if (!value) return null
	const components = [value.x, value.y, value.z ?? 0]
	return components.every(Number.isFinite) ? Math.hypot(...components) : null
}

function finiteOrNull(value?: number | null) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}
