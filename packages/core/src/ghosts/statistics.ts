import { addTransition } from '../utils/addTransition'
import { distance } from '../utils/distance'
import { SPEED_CAP_KMH, TURN_DEADZONE } from './constants'
import { emptySurfaceValues, normalizeSurface } from './surfaces'
import type { GhostFrame, GhostStatisticValues, KnownSurface, Vector2, Vector3 } from './types'

type NumericValidator = (value: unknown, field: string) => number | null

function toNumber(value: unknown, field: string): number | null {
	if (value === undefined || value === null) return null
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

function first(source: Record<string, unknown>, ...keys: string[]): unknown {
	for (const key of keys) {
		if (source[key] !== undefined) return source[key]
	}
	return undefined
}

export function emptyGhostStatistics(frameCount: number | null = null): GhostStatisticValues {
	return {
		frameCount,
		time: null,
		distance: null,
		distanceInAir: null,
		distanceOnGround: null,
		distanceOn1Wheel: null,
		distanceOn2Wheels: null,
		distanceOn3Wheels: null,
		distanceOn4Wheels: null,
		timeInAir: null,
		timeOnGround: null,
		timeOn1Wheel: null,
		timeOn2Wheels: null,
		timeOn3Wheels: null,
		timeOn4Wheels: null,
		averageSpeed: null,
		maxSpeed: null,
		armsUpCount: null,
		armsUpTime: null,
		brakeCount: null,
		brakeTime: null,
		turnLeftCount: null,
		turnLeftTime: null,
		turnRightCount: null,
		turnRightTime: null,
		hornCount: null,
		hornTime: null,
		distanceSlipping: null,
		distanceParaglider: null,
		distanceOffroadWheels: null,
		distanceSoapWheels: null,
		distanceOnMonorail: null,
		distanceParked: null,
		timeSlipping: null,
		timeParaglider: null,
		timeOffroadWheels: null,
		timeSoapWheels: null,
		timeOnMonorail: null,
		timeParked: null,
		distanceOnTarmac: null,
		distanceOnGrass: null,
		distanceOnSand: null,
		distanceOnSnow: null,
		distanceOnIce: null,
		distanceOnSoap: null,
		distanceOnMetal: null,
		timeOnTarmac: null,
		timeOnGrass: null,
		timeOnSand: null,
		timeOnSnow: null,
		timeOnIce: null,
		timeOnSoap: null,
		timeOnMetal: null,
		averageVelocity: null,
		maxVelocity: null,
		averageAngularVelocity: null,
		maxAngularVelocity: null,
		averageGforce: null,
		maxGforce: null,
	}
}

export function validateGhostStatisticPayload(payload: unknown): GhostStatisticValues {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('Invalid ghost statistic payload')
	}
	const source = payload as Record<string, unknown>
	const surfaceDistance = readSurfaceValues(
		first(source, 'surfaceDistance', 'surface_distance'),
		'surfaceDistance',
		toNumber,
	)
	const surfaceTime = readSurfaceValues(
		first(source, 'surfaceTime', 'surface_time'),
		'surfaceTime',
		toNumber,
	)
	return {
		frameCount: toCount(first(source, 'frameCount', 'frame_count'), 'frameCount'),
		time: toNumber(first(source, 'time', 'duration'), 'time'),
		distance: toNumber(
			first(source, 'distance', 'distanceTravelled', 'distance_travelled'),
			'distance',
		),
		distanceInAir: toNumber(first(source, 'distanceInAir', 'distance_in_air'), 'distanceInAir'),
		distanceOnGround: toNumber(
			first(source, 'distanceOnGround', 'distance_on_ground'),
			'distanceOnGround',
		),
		distanceOn1Wheel: toNumber(
			first(source, 'distanceOn1Wheel', 'distance_on_1_wheel'),
			'distanceOn1Wheel',
		),
		distanceOn2Wheels: toNumber(
			first(source, 'distanceOn2Wheels', 'distance_on_2_wheels'),
			'distanceOn2Wheels',
		),
		distanceOn3Wheels: toNumber(
			first(source, 'distanceOn3Wheels', 'distance_on_3_wheels'),
			'distanceOn3Wheels',
		),
		distanceOn4Wheels: toNumber(
			first(source, 'distanceOn4Wheels', 'distance_on_4_wheels'),
			'distanceOn4Wheels',
		),
		timeInAir: toNumber(first(source, 'timeInAir', 'time_in_air'), 'timeInAir'),
		timeOnGround: toNumber(first(source, 'timeOnGround', 'time_on_ground'), 'timeOnGround'),
		timeOn1Wheel: toNumber(first(source, 'timeOn1Wheel', 'time_on_1_wheel'), 'timeOn1Wheel'),
		timeOn2Wheels: toNumber(
			first(source, 'timeOn2Wheels', 'time_on_2_wheels'),
			'timeOn2Wheels',
		),
		timeOn3Wheels: toNumber(
			first(source, 'timeOn3Wheels', 'time_on_3_wheels'),
			'timeOn3Wheels',
		),
		timeOn4Wheels: toNumber(
			first(source, 'timeOn4Wheels', 'time_on_4_wheels'),
			'timeOn4Wheels',
		),
		averageSpeed: toNumber(first(source, 'averageSpeed', 'average_speed'), 'averageSpeed'),
		maxSpeed: toNumber(
			first(source, 'maxSpeed', 'max_speed', 'topSpeed', 'top_speed'),
			'maxSpeed',
		),
		armsUpCount: toCount(first(source, 'armsUpCount', 'arms_up_count'), 'armsUpCount'),
		armsUpTime: toNumber(first(source, 'armsUpTime', 'arms_up_time'), 'armsUpTime'),
		brakeCount: toCount(first(source, 'brakeCount', 'brake_count'), 'brakeCount'),
		brakeTime: toNumber(first(source, 'brakeTime', 'brake_time'), 'brakeTime'),
		turnLeftCount: toCount(first(source, 'turnLeftCount', 'turn_left_count'), 'turnLeftCount'),
		turnLeftTime: toNumber(first(source, 'turnLeftTime', 'turn_left_time'), 'turnLeftTime'),
		turnRightCount: toCount(
			first(source, 'turnRightCount', 'turn_right_count'),
			'turnRightCount',
		),
		turnRightTime: toNumber(first(source, 'turnRightTime', 'turn_right_time'), 'turnRightTime'),
		hornCount: toCount(first(source, 'hornCount', 'horn_count'), 'hornCount'),
		hornTime: toNumber(first(source, 'hornTime', 'horn_time'), 'hornTime'),
		distanceSlipping: toNumber(
			first(source, 'distanceSlipping', 'distance_slipping'),
			'distanceSlipping',
		),
		distanceParaglider: toNumber(
			first(source, 'distanceParaglider', 'distance_paraglider'),
			'distanceParaglider',
		),
		distanceOffroadWheels: toNumber(
			first(source, 'distanceOffroadWheels', 'distance_offroad_wheels'),
			'distanceOffroadWheels',
		),
		distanceSoapWheels: toNumber(
			first(source, 'distanceSoapWheels', 'distance_soap_wheels'),
			'distanceSoapWheels',
		),
		distanceOnMonorail: toNumber(
			first(source, 'distanceOnMonorail', 'distance_on_monorail'),
			'distanceOnMonorail',
		),
		distanceParked: toNumber(
			first(source, 'distanceParked', 'distance_parked'),
			'distanceParked',
		),
		timeSlipping: toNumber(first(source, 'timeSlipping', 'time_slipping'), 'timeSlipping'),
		timeParaglider: toNumber(
			first(source, 'timeParaglider', 'time_paraglider', 'paragliderTime', 'paraglider_time'),
			'timeParaglider',
		),
		timeOffroadWheels: toNumber(
			first(
				source,
				'timeOffroadWheels',
				'time_offroad_wheels',
				'offroadTime',
				'offroad_time',
			),
			'timeOffroadWheels',
		),
		timeSoapWheels: toNumber(
			first(source, 'timeSoapWheels', 'time_soap_wheels', 'soapTime', 'soap_time'),
			'timeSoapWheels',
		),
		timeOnMonorail: toNumber(
			first(source, 'timeOnMonorail', 'time_on_monorail'),
			'timeOnMonorail',
		),
		timeParked: toNumber(first(source, 'timeParked', 'time_parked'), 'timeParked'),
		distanceOnTarmac:
			toNumber(first(source, 'distanceOnTarmac', 'distance_on_tarmac'), 'distanceOnTarmac') ??
			surfaceDistance.tarmac,
		distanceOnGrass:
			toNumber(first(source, 'distanceOnGrass', 'distance_on_grass'), 'distanceOnGrass') ??
			surfaceDistance.grass,
		distanceOnSand:
			toNumber(first(source, 'distanceOnSand', 'distance_on_sand'), 'distanceOnSand') ??
			surfaceDistance.sand,
		distanceOnSnow:
			toNumber(first(source, 'distanceOnSnow', 'distance_on_snow'), 'distanceOnSnow') ??
			surfaceDistance.snow,
		distanceOnIce:
			toNumber(first(source, 'distanceOnIce', 'distance_on_ice'), 'distanceOnIce') ??
			surfaceDistance.ice,
		distanceOnSoap:
			toNumber(first(source, 'distanceOnSoap', 'distance_on_soap'), 'distanceOnSoap') ??
			surfaceDistance.soap,
		distanceOnMetal:
			toNumber(first(source, 'distanceOnMetal', 'distance_on_metal'), 'distanceOnMetal') ??
			surfaceDistance.metal,
		timeOnTarmac:
			toNumber(first(source, 'timeOnTarmac', 'time_on_tarmac'), 'timeOnTarmac') ??
			surfaceTime.tarmac,
		timeOnGrass:
			toNumber(first(source, 'timeOnGrass', 'time_on_grass'), 'timeOnGrass') ??
			surfaceTime.grass,
		timeOnSand:
			toNumber(first(source, 'timeOnSand', 'time_on_sand'), 'timeOnSand') ?? surfaceTime.sand,
		timeOnSnow:
			toNumber(first(source, 'timeOnSnow', 'time_on_snow'), 'timeOnSnow') ?? surfaceTime.snow,
		timeOnIce:
			toNumber(first(source, 'timeOnIce', 'time_on_ice'), 'timeOnIce') ?? surfaceTime.ice,
		timeOnSoap:
			toNumber(first(source, 'timeOnSoap', 'time_on_soap'), 'timeOnSoap') ?? surfaceTime.soap,
		timeOnMetal:
			toNumber(first(source, 'timeOnMetal', 'time_on_metal'), 'timeOnMetal') ??
			surfaceTime.metal,
		averageVelocity: toNumber(
			first(source, 'averageVelocity', 'average_velocity'),
			'averageVelocity',
		),
		maxVelocity: toNumber(first(source, 'maxVelocity', 'max_velocity'), 'maxVelocity'),
		averageAngularVelocity: toNumber(
			first(source, 'averageAngularVelocity', 'average_angular_velocity'),
			'averageAngularVelocity',
		),
		maxAngularVelocity: toNumber(
			first(source, 'maxAngularVelocity', 'max_angular_velocity'),
			'maxAngularVelocity',
		),
		averageGforce: toNumber(first(source, 'averageGforce', 'average_gforce'), 'averageGforce'),
		maxGforce: toNumber(first(source, 'maxGforce', 'max_gforce'), 'maxGforce'),
	}
}

export function calculateGhostStatistics(frames: GhostFrame[]): GhostStatisticValues {
	if (frames.length === 0) return emptyGhostStatistics(0)

	let totalDistance = 0
	let distanceInAir = 0
	let distanceOnGround = 0
	const distanceOnWheels: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
	let distanceSlipping = 0
	let distanceParaglider = 0
	let distanceOffroadWheels = 0
	let distanceSoapWheels = 0
	let distanceOnMonorail = 0
	let distanceParked = 0
	const surfaceDistance = emptySurfaceValues()
	const surfaceTime = emptySurfaceValues()

	let speedTime = 0
	let speedWeighted = 0
	let maxSpeed: number | null = null
	let velocityTime = 0
	let velocityWeighted = 0
	let maxVelocity: number | null = null
	let angularVelocityTime = 0
	let angularVelocityWeighted = 0
	let maxAngularVelocity: number | null = null
	let gforceTime = 0
	let gforceWeighted = 0
	let maxGforce: number | null = null

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
	let timeInAir = 0
	let timeOnGround = 0
	const timeOnWheels: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
	let timeSlipping = 0
	let timeParaglider = 0
	let timeOffroadWheels = 0
	let timeSoapWheels = 0
	let timeOnMonorail = 0
	let timeParked = 0

	let hasInputStats = false
	let hasHornStats = false
	let hasStateStats = false
	let hasAirStats = false
	let hasWheelStats = false
	let hasSlipStats = false
	let hasSurfaceStats = false
	let hasParkingStats = false
	let hasMonorailStats = false

	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i]
		const previous = frames[i - 1]
		if (!frame || !Number.isFinite(frame.time) || !isFiniteVector3(frame.position)) {
			throw new Error('Invalid ghost frame')
		}

		hasInputStats ||= typeof frame.armsUp === 'boolean' || typeof frame.braking === 'boolean'
		hasHornStats ||= typeof frame.horn === 'boolean'
		hasStateStats ||= hasFrameState(frame)
		hasAirStats ||= typeof frame.inAir === 'boolean'
		hasWheelStats ||= typeof frame.groundedWheelState === 'number'
		hasSlipStats ||= typeof frame.slippingWheelState === 'number'
		hasSurfaceStats ||= Boolean(frame.surface || frame.surfaces?.length)
		hasParkingStats ||= typeof frame.parkingBlock === 'boolean'
		hasMonorailStats ||= typeof frame.monorail === 'boolean'

		if (typeof frame.speed === 'number' && Number.isFinite(frame.speed)) {
			maxSpeed = maxValue(maxSpeed, Math.min(frame.speed, SPEED_CAP_KMH))
		}
		if (frame.localVelocity) {
			const velocity = magnitude3(frame.localVelocity)
			if (Number.isFinite(velocity)) maxVelocity = maxValue(maxVelocity, velocity)
		}
		if (frame.localAngularVelocity) {
			const angularVelocity = magnitude3(frame.localAngularVelocity)
			if (Number.isFinite(angularVelocity)) {
				maxAngularVelocity = maxValue(maxAngularVelocity, angularVelocity)
			}
		}
		if (frame.localGForce) {
			const gforce = magnitude2(frame.localGForce)
			if (Number.isFinite(gforce)) maxGforce = maxValue(maxGforce, gforce)
		}

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
			totalDistance += segmentDistance
			if (previous.inAir === true) distanceInAir += segmentDistance
			if (previous.inAir === false) distanceOnGround += segmentDistance
			const groundedWheels = countBits(previous.groundedWheelState)
			if (isWheelCount(groundedWheels)) {
				distanceOnWheels[groundedWheels] += segmentDistance
			}
			if ((previous.slippingWheelState ?? 0) !== 0) distanceSlipping += segmentDistance
			if (previous.paraglider) distanceParaglider += segmentDistance
			if (previous.offroad) distanceOffroadWheels += segmentDistance
			if (previous.soap) distanceSoapWheels += segmentDistance
			if (previous.monorail) distanceOnMonorail += segmentDistance
			if (previous.parkingBlock) distanceParked += segmentDistance
			addSegmentToSurfaces(surfaceDistance, getFrameSurfaces(previous), segmentDistance)
		}

		const speed = typeof previous.speed === 'number' ? previous.speed : impliedSpeed
		if (Number.isFinite(speed)) {
			speedTime += dt
			speedWeighted += Math.min(speed, SPEED_CAP_KMH) * dt
			maxSpeed = maxValue(maxSpeed, Math.min(speed, SPEED_CAP_KMH))
		}

		if (previous.localVelocity) {
			const velocity = magnitude3(previous.localVelocity)
			if (Number.isFinite(velocity)) {
				velocityTime += dt
				velocityWeighted += velocity * dt
				maxVelocity = maxValue(maxVelocity, velocity)
			}
		}
		if (previous.localAngularVelocity) {
			const angularVelocity = magnitude3(previous.localAngularVelocity)
			if (Number.isFinite(angularVelocity)) {
				angularVelocityTime += dt
				angularVelocityWeighted += angularVelocity * dt
				maxAngularVelocity = maxValue(maxAngularVelocity, angularVelocity)
			}
		}
		if (previous.localGForce) {
			const gforce = magnitude2(previous.localGForce)
			if (Number.isFinite(gforce)) {
				gforceTime += dt
				gforceWeighted += gforce * dt
				maxGforce = maxValue(maxGforce, gforce)
			}
		}

		if (previous.armsUp) armsUpTime += dt
		if (previous.braking) brakeTime += dt
		if (previous.horn) hornTime += dt
		if (typeof previous.steering === 'number' && previous.steering < -TURN_DEADZONE)
			turnLeftTime += dt
		if (typeof previous.steering === 'number' && previous.steering > TURN_DEADZONE)
			turnRightTime += dt
		if (previous.inAir === true) timeInAir += dt
		if (previous.inAir === false) timeOnGround += dt
		const groundedWheels = countBits(previous.groundedWheelState)
		if (isWheelCount(groundedWheels)) {
			timeOnWheels[groundedWheels] += dt
		}
		if ((previous.slippingWheelState ?? 0) !== 0) timeSlipping += dt
		if (previous.paraglider) timeParaglider += dt
		if (previous.offroad) timeOffroadWheels += dt
		if (previous.soap) timeSoapWheels += dt
		if (previous.monorail) timeOnMonorail += dt
		if (previous.parkingBlock) timeParked += dt
		addSegmentToSurfaces(surfaceTime, getFrameSurfaces(previous), dt)
	}

	const duration = frames.at(-1)?.time
	return {
		frameCount: frames.length,
		time: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
		distance: totalDistance,
		distanceInAir: hasAirStats ? distanceInAir : null,
		distanceOnGround: hasAirStats ? distanceOnGround : null,
		distanceOn1Wheel: hasWheelStats ? distanceOnWheels[1] : null,
		distanceOn2Wheels: hasWheelStats ? distanceOnWheels[2] : null,
		distanceOn3Wheels: hasWheelStats ? distanceOnWheels[3] : null,
		distanceOn4Wheels: hasWheelStats ? distanceOnWheels[4] : null,
		timeInAir: hasAirStats ? timeInAir : null,
		timeOnGround: hasAirStats ? timeOnGround : null,
		timeOn1Wheel: hasWheelStats ? timeOnWheels[1] : null,
		timeOn2Wheels: hasWheelStats ? timeOnWheels[2] : null,
		timeOn3Wheels: hasWheelStats ? timeOnWheels[3] : null,
		timeOn4Wheels: hasWheelStats ? timeOnWheels[4] : null,
		averageSpeed: speedTime > 0 ? speedWeighted / speedTime : null,
		maxSpeed,
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
		distanceSlipping: hasSlipStats ? distanceSlipping : null,
		distanceParaglider: hasStateStats ? distanceParaglider : null,
		distanceOffroadWheels: hasStateStats ? distanceOffroadWheels : null,
		distanceSoapWheels: hasStateStats ? distanceSoapWheels : null,
		distanceOnMonorail: hasMonorailStats ? distanceOnMonorail : null,
		distanceParked: hasParkingStats ? distanceParked : null,
		timeSlipping: hasSlipStats ? timeSlipping : null,
		timeParaglider: hasStateStats ? timeParaglider : null,
		timeOffroadWheels: hasStateStats ? timeOffroadWheels : null,
		timeSoapWheels: hasStateStats ? timeSoapWheels : null,
		timeOnMonorail: hasMonorailStats ? timeOnMonorail : null,
		timeParked: hasParkingStats ? timeParked : null,
		distanceOnTarmac: hasSurfaceStats ? surfaceDistance.tarmac : null,
		distanceOnGrass: hasSurfaceStats ? surfaceDistance.grass : null,
		distanceOnSand: hasSurfaceStats ? surfaceDistance.sand : null,
		distanceOnSnow: hasSurfaceStats ? surfaceDistance.snow : null,
		distanceOnIce: hasSurfaceStats ? surfaceDistance.ice : null,
		distanceOnSoap: hasSurfaceStats ? surfaceDistance.soap : null,
		distanceOnMetal: hasSurfaceStats ? surfaceDistance.metal : null,
		timeOnTarmac: hasSurfaceStats ? surfaceTime.tarmac : null,
		timeOnGrass: hasSurfaceStats ? surfaceTime.grass : null,
		timeOnSand: hasSurfaceStats ? surfaceTime.sand : null,
		timeOnSnow: hasSurfaceStats ? surfaceTime.snow : null,
		timeOnIce: hasSurfaceStats ? surfaceTime.ice : null,
		timeOnSoap: hasSurfaceStats ? surfaceTime.soap : null,
		timeOnMetal: hasSurfaceStats ? surfaceTime.metal : null,
		averageVelocity: velocityTime > 0 ? velocityWeighted / velocityTime : null,
		maxVelocity,
		averageAngularVelocity:
			angularVelocityTime > 0 ? angularVelocityWeighted / angularVelocityTime : null,
		maxAngularVelocity,
		averageGforce: gforceTime > 0 ? gforceWeighted / gforceTime : null,
		maxGforce,
	}
}

function isWheelCount(value: number): value is 1 | 2 | 3 | 4 {
	return value === 1 || value === 2 || value === 3 || value === 4
}

function readSurfaceValues(
	source: unknown,
	field: string,
	toNumber: NumericValidator,
): Record<KnownSurface, number | null> {
	if (source === undefined || source === null) return emptyNullSurfaceValues()
	if (typeof source !== 'object' || Array.isArray(source)) {
		throw new Error(`Invalid ghost statistic ${field}`)
	}
	const values = emptySurfaceValues()
	for (const [surface, value] of Object.entries(source)) {
		const number = toNumber(value, `${field}.${surface}`)
		if (number !== null) {
			values[normalizeSurface(surface)] += number
		}
	}
	return values
}

function emptyNullSurfaceValues(): Record<KnownSurface, null> {
	return {
		tarmac: null,
		grass: null,
		sand: null,
		snow: null,
		ice: null,
		soap: null,
		metal: null,
	}
}

function getFrameSurfaces(frame: GhostFrame): KnownSurface[] {
	if (frame.surfaces?.length) return frame.surfaces
	if (frame.surface) return [normalizeSurface(frame.surface)]
	return []
}

function addSegmentToSurfaces(
	target: Record<KnownSurface, number>,
	surfaces: KnownSurface[],
	value: number,
) {
	if (surfaces.length === 0) return
	const splitValue = value / surfaces.length
	for (const surface of surfaces) {
		target[surface] += splitValue
	}
}

function hasFrameState(frame: GhostFrame): boolean {
	return (
		typeof frame.soap === 'boolean' ||
		typeof frame.offroad === 'boolean' ||
		typeof frame.paraglider === 'boolean'
	)
}

function countBits(value: number | undefined): number {
	if (typeof value !== 'number') return 0
	let count = 0
	let remaining = value
	while (remaining > 0) {
		count += remaining & 1
		remaining >>= 1
	}
	return count
}

function maxValue(current: number | null, value: number): number {
	return current === null ? value : Math.max(current, value)
}

function magnitude3(value: Vector3): number {
	return Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z)
}

function magnitude2(value: Vector2): number {
	return Math.sqrt(value.x * value.x + value.y * value.y)
}

function isFiniteVector3(value: Vector3): boolean {
	return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}
