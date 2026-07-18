import type {
	GhostEventKind,
	GhostPlaybackFrame,
	GhostSlipEvent,
	GhostTimelineEvent,
} from '~/types/ghost'

type EventPredicate = (frame: GhostPlaybackFrame) => boolean

const EVENT_PREDICATES: ReadonlyArray<[GhostEventKind, EventPredicate]> = [
	['arms-up', (frame) => frame.armsUp === true],
	['braking', (frame) => frame.braking === true],
	['horn', (frame) => frame.horn === true],
	['paraglider', (frame) => frame.paraglider === true],
	['soap', (frame) => frame.soap === true],
	['offroad', (frame) => frame.offroad === true],
	['airborne', (frame) => frame.inAir === true],
	['slipping', (frame) => (frame.slippingWheelState ?? 0) !== 0],
	['ragdoll', (frame) => frame.ragdoll === true],
	['parking', (frame) => frame.parkingBlock === true],
	['monorail', (frame) => frame.monorail === true],
]

export function buildGhostTimelineEvents(
	frames: readonly GhostPlaybackFrame[],
	mergeGapSeconds = 0.1,
): GhostTimelineEvent[] {
	return EVENT_PREDICATES.flatMap(([kind, predicate]) =>
		buildIntervals(frames, kind, predicate, mergeGapSeconds),
	).toSorted((left, right) => left.start - right.start || left.kind.localeCompare(right.kind))
}

export function buildGhostSlipEvents(frames: readonly GhostPlaybackFrame[]): GhostSlipEvent[] {
	const intervals = buildIntervals(
		frames,
		'slipping',
		(frame) => (frame.slippingWheelState ?? 0) !== 0,
		0.1,
	)
	return intervals.flatMap((interval, index) => {
		const eventFrames = frames.slice(interval.startFrame, interval.endFrame + 1)
		const distance = pathDistance(eventFrames)
		const entrySpeed = finiteOrNull(eventFrames[0]?.speed)
		const exitSpeed = finiteOrNull(eventFrames.at(-1)?.speed)
		const speeds = eventFrames.flatMap((frame) =>
			Number.isFinite(frame.speed) ? [frame.speed as number] : [],
		)
		const steering = eventFrames.flatMap((frame) =>
			Number.isFinite(frame.steering) ? [frame.steering as number] : [],
		)
		const majorSpeedLoss =
			entrySpeed !== null &&
			exitSpeed !== null &&
			entrySpeed > 0 &&
			exitSpeed / entrySpeed < 0.85
		if (interval.duration < 0.15 && distance < 1 && !majorSpeedLoss) return []
		return [
			{
				id: `slipping-${index}-${interval.start.toFixed(3)}`,
				start: interval.start,
				end: interval.end,
				duration: interval.duration,
				distance,
				entrySpeed,
				exitSpeed,
				maximumSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
				speedRetention:
					entrySpeed !== null && entrySpeed > 0 && exitSpeed !== null
						? exitSpeed / entrySpeed
						: null,
				wheelState: eventFrames.reduce(
					(state, frame) => state | (frame.slippingWheelState ?? 0),
					0,
				),
				averageSteering:
					steering.length > 0
						? steering.reduce((total, value) => total + value, 0) / steering.length
						: null,
				peakSteering:
					steering.length > 0
						? Math.max(...steering.map((value) => Math.abs(value)))
						: null,
			},
		]
	})
}

export function pathDistance(frames: readonly GhostPlaybackFrame[]): number {
	let distance = 0
	for (let index = 1; index < frames.length; index++) {
		const previous = frames[index - 1]?.position
		const current = frames[index]?.position
		if (!previous || !current) continue
		distance += Math.hypot(
			current.x - previous.x,
			current.y - previous.y,
			current.z - previous.z,
		)
	}
	return distance
}

function buildIntervals(
	frames: readonly GhostPlaybackFrame[],
	kind: GhostEventKind,
	predicate: EventPredicate,
	mergeGapSeconds: number,
): GhostTimelineEvent[] {
	const intervals: GhostTimelineEvent[] = []
	let startFrame: number | null = null
	for (let index = 0; index < frames.length; index++) {
		const frame = frames[index]
		if (!frame) continue
		if (predicate(frame)) {
			startFrame ??= index
			continue
		}
		if (startFrame !== null) {
			intervals.push(
				createInterval(frames, kind, startFrame, Math.max(startFrame, index - 1)),
			)
			startFrame = null
		}
	}
	if (startFrame !== null) {
		intervals.push(createInterval(frames, kind, startFrame, frames.length - 1))
	}
	return mergeIntervals(intervals, mergeGapSeconds)
}

function createInterval(
	frames: readonly GhostPlaybackFrame[],
	kind: GhostEventKind,
	startFrame: number,
	endFrame: number,
): GhostTimelineEvent {
	const start = frames[startFrame]?.time ?? 0
	const end = frames[endFrame]?.time ?? start
	return {
		id: `${kind}-${startFrame}-${endFrame}`,
		kind,
		start,
		end,
		duration: Math.max(0, end - start),
		startFrame,
		endFrame,
	}
}

function mergeIntervals(events: GhostTimelineEvent[], maximumGap: number): GhostTimelineEvent[] {
	const merged: GhostTimelineEvent[] = []
	for (const event of events) {
		const previous = merged.at(-1)
		if (previous && event.start - previous.end <= maximumGap) {
			previous.end = event.end
			previous.endFrame = event.endFrame
			previous.duration = Math.max(0, previous.end - previous.start)
			continue
		}
		merged.push({ ...event })
	}
	return merged
}

function finiteOrNull(value: number | null | undefined) {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}
