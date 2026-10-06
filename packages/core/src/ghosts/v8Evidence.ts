import { assertGhostFrameCount } from './limits'
import type { DecodedProtobufGhost } from './protobuf'

export type SphereSample = { time: number; position: [number, number, number]; radius: number }
export type TriggerEvent = {
	blockUid: string
	shape: string
	finish: boolean
	rawTime: number
	adjustedTime: number
	velocityKmh: number
	sample: SphereSample
}
export type RunEvidence = {
	sphereSamplingVersion?: number
	runUuid: string
	levelUid: string
	submissionLevel: string
	canonicalHash: string
	initialTime: number
	physicsInterval: number
	samples: SphereSample[]
	events: TriggerEvent[]
}

function sample(value: unknown): value is SphereSample {
	if (!value || typeof value !== 'object') return false
	const s = value as SphereSample
	return (
		Number.isFinite(s.time) &&
		s.time >= 0 &&
		Number.isFinite(s.radius) &&
		s.radius > 0 &&
		Array.isArray(s.position) &&
		s.position.length === 3 &&
		s.position.every(Number.isFinite)
	)
}

export function readRunEvidence(decoded: DecodedProtobufGhost): RunEvidence {
	if (!decoded.evidenceJson) throw new Error('Missing V8 evidence')
	const value = JSON.parse(decoded.evidenceJson) as RunEvidence
	if (
		!value ||
		(value.sphereSamplingVersion !== undefined &&
			(!Number.isInteger(value.sphereSamplingVersion) ||
				value.sphereSamplingVersion < 0 ||
				value.sphereSamplingVersion > 4294967295)) ||
		typeof value !== 'object' ||
		typeof value.runUuid !== 'string' ||
		typeof value.levelUid !== 'string' ||
		typeof value.submissionLevel !== 'string' ||
		typeof value.canonicalHash !== 'string' ||
		!Number.isFinite(value.initialTime) ||
		!Number.isFinite(value.physicsInterval) ||
		!Array.isArray(value.samples) ||
		!value.samples.every(sample) ||
		!Array.isArray(value.events) ||
		value.events.length > 20001 ||
		!value.events.every(
			(event) =>
				event &&
				typeof event.blockUid === 'string' &&
				typeof event.shape === 'string' &&
				typeof event.finish === 'boolean' &&
				Number.isFinite(event.velocityKmh) &&
				Number.isFinite(event.rawTime) &&
				Number.isFinite(event.adjustedTime) &&
				sample(event.sample),
		)
	) {
		throw new Error('Invalid V8 evidence')
	}
	assertGhostFrameCount(value.samples.length)
	return value
}
