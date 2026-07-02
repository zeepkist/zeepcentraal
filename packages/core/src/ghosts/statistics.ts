import { addTransition } from '../utils/addTransition'
import { distance } from '../utils/distance'
import { SPEED_CAP_KMH, TURN_DEADZONE } from './constants'
import { addSurfaceValues, emptySurfaceValues } from './surfaces'
import type { GhostFrame, GhostStatisticValues, KnownSurface } from './types'

function toNumber(value: unknown, field: string): number | null {
	if (value === undefined || value === null) {
		return null
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new Error(`Invalid ghost statistic ${field}`)
	}
	return value
}

function toCount(value: unknown, field: string): number | null {
	const number = toNumber(value, field)
	if (number !== null && !Number.isInteger(number)) {
		throw new Error(`Invalid ghost statistic ${field}`)
	}
	return number
}

export function validateGhostStatisticPayload(payload: unknown): GhostStatisticValues {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('Invalid ghost statistic payload')
	}
	const source = payload as Record<string, unknown>
	const distance = emptySurfaceValues()
	const time = emptySurfaceValues()
	addSurfaceValues(
		distance,
		source.surfaceDistance ?? source.surface_distance,
		'surfaceDistance',
		toNumber,
	)
	addSurfaceValues(time, source.surfaceTime ?? source.surface_time, 'surfaceTime', toNumber)
	return {
		frameCount: toCount(source.frameCount ?? source.frame_count, 'frameCount'),
		duration: toNumber(source.duration, 'duration'),
		distanceTravelled: toNumber(
			source.distanceTravelled ?? source.distance_travelled,
			'distanceTravelled',
		),
		distanceInAir: toNumber(source.distanceInAir ?? source.distance_in_air, 'distanceInAir'),
		distanceOnGround: toNumber(
			source.distanceOnGround ?? source.distance_on_ground,
			'distanceOnGround',
		),
		timeInAir: toNumber(source.timeInAir ?? source.time_in_air, 'timeInAir'),
		timeOnGround: toNumber(source.timeOnGround ?? source.time_on_ground, 'timeOnGround'),
		averageSpeed: toNumber(source.averageSpeed ?? source.average_speed, 'averageSpeed'),
		topSpeed: toNumber(source.topSpeed ?? source.top_speed, 'topSpeed'),
		armsUpCount: toCount(source.armsUpCount ?? source.arms_up_count, 'armsUpCount'),
		armsUpTime: toNumber(source.armsUpTime ?? source.arms_up_time, 'armsUpTime'),
		brakeCount: toCount(source.brakeCount ?? source.brake_count, 'brakeCount'),
		brakeTime: toNumber(source.brakeTime ?? source.brake_time, 'brakeTime'),
		turnLeftCount: toCount(source.turnLeftCount ?? source.turn_left_count, 'turnLeftCount'),
		turnLeftTime: toNumber(source.turnLeftTime ?? source.turn_left_time, 'turnLeftTime'),
		turnRightCount: toCount(source.turnRightCount ?? source.turn_right_count, 'turnRightCount'),
		turnRightTime: toNumber(source.turnRightTime ?? source.turn_right_time, 'turnRightTime'),
		hornCount: toCount(source.hornCount ?? source.horn_count, 'hornCount'),
		hornTime: toNumber(source.hornTime ?? source.horn_time, 'hornTime'),
		soapTime: toNumber(source.soapTime ?? source.soap_time, 'soapTime'),
		offroadTime: toNumber(source.offroadTime ?? source.offroad_time, 'offroadTime'),
		paragliderTime: toNumber(source.paragliderTime ?? source.paraglider_time, 'paragliderTime'),
		distanceOnTarmac: distance.tarmac,
		distanceOnGrass: distance.grass,
		distanceOnSand: distance.sand,
		distanceOnSnow: distance.snow,
		distanceOnIce: distance.ice,
		distanceOnSoap: distance.soap,
		distanceOnMetal: distance.metal,
		timeOnTarmac: time.tarmac,
		timeOnGrass: time.grass,
		timeOnSand: time.sand,
		timeOnSnow: time.snow,
		timeOnIce: time.ice,
		timeOnSoap: time.soap,
		timeOnMetal: time.metal,
	}
}

export function calculateGhostStatistics(frames: GhostFrame[]): GhostStatisticValues {
	if (frames.length === 0) {
		throw new Error('Ghost has no frames')
	}
	let distanceTravelled = 0
	let distanceInAir = 0
	let distanceOnGround = 0
	let speedTime = 0
	let speedWeighted = 0
	let topSpeed: number | null = null
	let armsUpCount = 0
	let armsUpTime = 0
	let brakeCount = 0
	let brakeTime = 0
	let turnLeftCount = 0
	let turnLeftTime = 0
	let turnRightCount = 0
	let turnRightTime = 0
	let hornCount = 0
	let hornTime = 0
	let soapTime = 0
	let offroadTime = 0
	let paragliderTime = 0
	let timeInAir = 0
	let timeOnGround = 0
	let hasInputStats = false
	let hasHornStats = false
	let hasStateStats = false
	let hasAirStats = false
	let hasSpeedSamples = false
	const surfaceDistance = emptySurfaceValues()
	const surfaceTime = emptySurfaceValues()

	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i]
		const previous = frames[i - 1]
		if (!frame || !Number.isFinite(frame.time)) {
			throw new Error('Invalid ghost frame')
		}
		if (typeof frame.speed === 'number' && Number.isFinite(frame.speed)) {
			hasSpeedSamples = true
			topSpeed =
				topSpeed === null
					? Math.min(frame.speed, SPEED_CAP_KMH)
					: Math.max(topSpeed, Math.min(frame.speed, SPEED_CAP_KMH))
		}
		hasInputStats ||= typeof frame.armsUp === 'boolean' || typeof frame.braking === 'boolean'
		hasHornStats ||= typeof frame.horn === 'boolean'
		hasStateStats ||=
			typeof frame.soap === 'boolean' ||
			typeof frame.offroad === 'boolean' ||
			typeof frame.paraglider === 'boolean'
		hasAirStats ||= typeof frame.inAir === 'boolean'
		armsUpCount = addTransition(frame.armsUp, previous?.armsUp, armsUpCount)
		brakeCount = addTransition(frame.braking, previous?.braking, brakeCount)
		hornCount = addTransition(frame.horn, previous?.horn, hornCount)
		const turnLeft = typeof frame.steering === 'number' && frame.steering < -TURN_DEADZONE
		const wasTurnLeft =
			typeof previous?.steering === 'number' && previous.steering < -TURN_DEADZONE
		const turnRight = typeof frame.steering === 'number' && frame.steering > TURN_DEADZONE
		const wasTurnRight =
			typeof previous?.steering === 'number' && previous.steering > TURN_DEADZONE
		turnLeftCount = addTransition(turnLeft, wasTurnLeft, turnLeftCount)
		turnRightCount = addTransition(turnRight, wasTurnRight, turnRightCount)
		if (!previous) continue
		const dt = frame.time - previous.time
		if (!Number.isFinite(dt) || dt <= 0) continue
		const segmentDistance = distance(previous.position, frame.position)
		const impliedSpeed = (segmentDistance / dt) * 3.6
		const validSegment =
			Number.isFinite(segmentDistance) &&
			Number.isFinite(impliedSpeed) &&
			impliedSpeed <= SPEED_CAP_KMH
		if (validSegment) {
			distanceTravelled += segmentDistance
			if (previous.inAir === true) distanceInAir += segmentDistance
			if (previous.inAir === false) distanceOnGround += segmentDistance
			if (previous.surface && previous.surface in surfaceDistance) {
				surfaceDistance[previous.surface as KnownSurface] += segmentDistance
			}
		}
		const speed = typeof previous.speed === 'number' ? previous.speed : impliedSpeed
		if (Number.isFinite(speed)) {
			speedTime += dt
			speedWeighted += Math.min(speed, SPEED_CAP_KMH) * dt
			if (!hasSpeedSamples) {
				topSpeed =
					topSpeed === null
						? Math.min(speed, SPEED_CAP_KMH)
						: Math.max(topSpeed, Math.min(speed, SPEED_CAP_KMH))
			}
		}
		if (previous.armsUp) armsUpTime += dt
		if (previous.braking) brakeTime += dt
		if (previous.horn) hornTime += dt
		if (typeof previous.steering === 'number' && previous.steering < -TURN_DEADZONE)
			turnLeftTime += dt
		if (typeof previous.steering === 'number' && previous.steering > TURN_DEADZONE)
			turnRightTime += dt
		if (previous.soap) soapTime += dt
		if (previous.offroad) offroadTime += dt
		if (previous.paraglider) paragliderTime += dt
		if (previous.inAir === true) timeInAir += dt
		if (previous.inAir === false) timeOnGround += dt
		if (previous.surface && previous.surface in surfaceTime) {
			surfaceTime[previous.surface as KnownSurface] += dt
		}
	}
	const duration = frames.at(-1)?.time ?? null
	return validateGhostStatisticPayload({
		frameCount: frames.length,
		duration: Number.isFinite(duration) ? duration : null,
		distanceTravelled,
		distanceInAir: hasAirStats ? distanceInAir : null,
		distanceOnGround: hasAirStats ? distanceOnGround : null,
		timeInAir: hasAirStats ? timeInAir : null,
		timeOnGround: hasAirStats ? timeOnGround : null,
		averageSpeed: speedTime > 0 ? speedWeighted / speedTime : null,
		topSpeed,
		armsUpCount: hasInputStats ? armsUpCount : null,
		armsUpTime: hasInputStats ? armsUpTime : null,
		brakeCount: hasInputStats ? brakeCount : null,
		brakeTime: hasInputStats ? brakeTime : null,
		turnLeftCount: hasInputStats ? turnLeftCount : null,
		turnLeftTime: hasInputStats ? turnLeftTime : null,
		turnRightCount: hasInputStats ? turnRightCount : null,
		turnRightTime: hasInputStats ? turnRightTime : null,
		hornCount: hasHornStats ? hornCount : null,
		hornTime: hasHornStats ? hornTime : null,
		soapTime: hasStateStats ? soapTime : null,
		offroadTime: hasStateStats ? offroadTime : null,
		paragliderTime: hasStateStats ? paragliderTime : null,
		surfaceDistance,
		surfaceTime,
	})
}
