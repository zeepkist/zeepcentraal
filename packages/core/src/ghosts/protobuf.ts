import { decompress } from '@napi-rs/lzma/lzma'
import protobuf from 'protobufjs'
import { finite } from '../utils/finite'
import { remapByte } from '../utils/remapByte'
import { InputFlags, SoapboxFlags, SurfaceState } from './enums'
import { surfacesFromState } from './surfaces'
import type { GhostFrame, Vector2, Vector3 } from './types'

const POSITION_MULTIPLIER = 100_000
const ROTATION_MULTIPLIER = 100

const root = new protobuf.Root()
const vector3Type = new protobuf.Type('Vector3')
	.add(new protobuf.Field('x', 1, 'float'))
	.add(new protobuf.Field('y', 2, 'float'))
	.add(new protobuf.Field('z', 3, 'float'))
const vector3IntType = new protobuf.Type('Vector3Int')
	.add(new protobuf.Field('x', 1, 'int32'))
	.add(new protobuf.Field('y', 2, 'int32'))
	.add(new protobuf.Field('z', 3, 'int32'))
const vector2IntType = new protobuf.Type('Vector2Int')
	.add(new protobuf.Field('x', 1, 'int32'))
	.add(new protobuf.Field('y', 2, 'int32'))
const cosmeticsType = new protobuf.Type('Cosmetics')
	.add(new protobuf.Field('zeepkist', 1, 'int32'))
	.add(new protobuf.Field('hat', 2, 'int32'))
	.add(new protobuf.Field('glasses', 3, 'int32'))
	.add(new protobuf.Field('paraglider', 4, 'int32'))
	.add(new protobuf.Field('horn', 5, 'int32'))
	.add(new protobuf.Field('color', 6, 'int32'))
	.add(new protobuf.Field('colorBody', 7, 'int32'))
	.add(new protobuf.Field('colorLeftArm', 8, 'int32'))
	.add(new protobuf.Field('colorRightArm', 9, 'int32'))
	.add(new protobuf.Field('colorLeftLeg', 10, 'int32'))
	.add(new protobuf.Field('colorRightLeg', 11, 'int32'))
	.add(new protobuf.Field('frontWheels', 12, 'int32'))
	.add(new protobuf.Field('rearWheels', 13, 'int32'))
const initialFrameType = new protobuf.Type('InitialFrame')
	.add(new protobuf.Field('position', 1, 'Vector3'))
	.add(new protobuf.Field('rotation', 2, 'Vector3'))
	.add(new protobuf.Field('speed', 3, 'uint32'))
	.add(new protobuf.Field('steering', 4, 'uint32'))
	.add(new protobuf.Field('inputFlags', 5, 'int32'))
	.add(new protobuf.Field('soapboxFlags', 6, 'int32'))
	.add(new protobuf.Field('groundedWheelState', 7, 'int32'))
	.add(new protobuf.Field('slippingWheelState', 8, 'int32'))
	.add(new protobuf.Field('surfaceState', 9, 'int32'))
	.add(new protobuf.Field('localVelocity', 10, 'Vector3Int'))
	.add(new protobuf.Field('localAngularVelocity', 11, 'Vector3Int'))
	.add(new protobuf.Field('localGForce', 12, 'Vector2Int'))
	.add(new protobuf.Field('parkingBlockState', 13, 'bool'))
	.add(new protobuf.Field('monorailState', 14, 'bool'))
	.add(new protobuf.Field('ragdollState', 15, 'bool'))
	.add(new protobuf.Field('ragdollPosition', 16, 'Vector3Int'))
	.add(new protobuf.Field('ragdollRotation', 17, 'Vector3Int'))
const deltaFrameType = new protobuf.Type('DeltaFrame')
	.add(new protobuf.Field('time', 1, 'float'))
	.add(new protobuf.Field('position', 2, 'Vector3Int'))
	.add(new protobuf.Field('rotation', 3, 'Vector3Int'))
	.add(new protobuf.Field('speed', 4, 'uint32'))
	.add(new protobuf.Field('steering', 5, 'uint32'))
	.add(new protobuf.Field('inputFlags', 6, 'int32'))
	.add(new protobuf.Field('soapboxFlags', 7, 'int32'))
	.add(new protobuf.Field('groundedWheelState', 8, 'int32'))
	.add(new protobuf.Field('slippingWheelState', 9, 'int32'))
	.add(new protobuf.Field('surfaceState', 10, 'int32'))
	.add(new protobuf.Field('localVelocity', 11, 'Vector3Int'))
	.add(new protobuf.Field('localAngularVelocity', 12, 'Vector3Int'))
	.add(new protobuf.Field('localGForce', 13, 'Vector2Int'))
	.add(new protobuf.Field('parkingBlockState', 14, 'bool'))
	.add(new protobuf.Field('monorailState', 15, 'bool'))
	.add(new protobuf.Field('ragdollState', 16, 'bool'))
	.add(new protobuf.Field('ragdollPosition', 17, 'Vector3Int'))
	.add(new protobuf.Field('ragdollRotation', 18, 'Vector3Int'))
const ghostType = new protobuf.Type('Ghost')
	.add(new protobuf.Field('version', 1, 'int32'))
	.add(new protobuf.Field('steamId', 2, 'uint64'))
	.add(new protobuf.Field('cosmetics', 3, 'Cosmetics'))
	.add(new protobuf.Field('initialFrame', 4, 'InitialFrame'))
	.add(new protobuf.Field('deltaFrames', 5, 'DeltaFrame', 'repeated'))
	.add(new protobuf.Field('taggedUsername', 6, 'string'))
	.add(new protobuf.Field('color', 7, 'string'))

root.define('gtr')
	.add(vector3Type)
	.add(vector3IntType)
	.add(vector2IntType)
	.add(cosmeticsType)
	.add(initialFrameType)
	.add(deltaFrameType)
	.add(ghostType)

export type DecodedProtobufGhost = {
	version?: number
	initialFrame?: {
		position?: Vector3
		rotation?: Vector3
		speed?: number
		steering?: number
		inputFlags?: number
		soapboxFlags?: number
		groundedWheelState?: number
		slippingWheelState?: number
		surfaceState?: number
		localVelocity?: Vector3
		localAngularVelocity?: Vector3
		localGForce?: Vector2
		parkingBlockState?: boolean
		monorailState?: boolean
		ragdollState?: boolean
		ragdollPosition?: Vector3
		ragdollRotation?: Vector3
	}
	deltaFrames?: Array<{
		time?: number
		position?: Vector3
		rotation?: Vector3
		speed?: number
		steering?: number
		inputFlags?: number
		soapboxFlags?: number
		groundedWheelState?: number
		slippingWheelState?: number
		surfaceState?: number
		localVelocity?: Vector3
		localAngularVelocity?: Vector3
		localGForce?: Vector2
		parkingBlockState?: boolean
		monorailState?: boolean
		ragdollState?: boolean
		ragdollPosition?: Vector3
		ragdollRotation?: Vector3
	}>
}

export async function decodeProtobufGhost(buffer: Buffer): Promise<DecodedProtobufGhost> {
	const decompressed = await decompress(new Uint8Array(buffer))
	return ghostType.decode(decompressed) as unknown as DecodedProtobufGhost
}

export function readProtobufFrames(decoded: DecodedProtobufGhost): GhostFrame[] {
	if (!decoded.initialFrame?.position || !decoded.deltaFrames) {
		throw new Error('Invalid protobuf ghost')
	}
	const frames: GhostFrame[] = []
	let position = decoded.initialFrame.position
	let rotation = decoded.initialFrame.rotation
	let ragdollActive = decoded.initialFrame.ragdollState === true
	let ragdollPosition = ragdollActive
		? requireUnscaledVector3(decoded.initialFrame.ragdollPosition, POSITION_MULTIPLIER)
		: undefined
	let ragdollRotation = ragdollActive
		? requireUnscaledVector3(decoded.initialFrame.ragdollRotation, ROTATION_MULTIPLIER)
		: undefined
	frames.push(
		frameFromProtobuf(0, position, {
			...decoded.initialFrame,
			ragdollPosition,
			ragdollRotation,
		}),
	)
	for (const deltaFrame of decoded.deltaFrames) {
		const delta = deltaFrame.position
		if (!delta || typeof deltaFrame.time !== 'number') {
			throw new Error('Invalid protobuf ghost frame')
		}
		position = {
			x: position.x + delta.x / POSITION_MULTIPLIER,
			y: position.y + delta.y / POSITION_MULTIPLIER,
			z: position.z + delta.z / POSITION_MULTIPLIER,
		}
		rotation = deltaFrame.rotation
			? unscaleVector3(deltaFrame.rotation, ROTATION_MULTIPLIER)
			: rotation
		if (ragdollActive && deltaFrame.ragdollState === false) {
			throw new Error('Invalid protobuf ghost ragdoll state')
		}
		if (deltaFrame.ragdollState === true) {
			const deltaRagdollPosition = requireUnscaledVector3(
				deltaFrame.ragdollPosition,
				POSITION_MULTIPLIER,
			)
			const deltaRagdollRotation = requireUnscaledVector3(
				deltaFrame.ragdollRotation,
				ROTATION_MULTIPLIER,
			)
			ragdollPosition = ragdollActive
				? addVector3(ragdollPosition, deltaRagdollPosition)
				: deltaRagdollPosition
			ragdollRotation = ragdollActive
				? addVector3(ragdollRotation, deltaRagdollRotation)
				: deltaRagdollRotation
			ragdollActive = true
		}
		frames.push(
			frameFromProtobuf(
				deltaFrame.time,
				position,
				{
					...deltaFrame,
					ragdollPosition: ragdollActive ? ragdollPosition : undefined,
					ragdollRotation: ragdollActive ? ragdollRotation : undefined,
				},
				rotation,
			),
		)
	}
	return frames
}

function frameFromProtobuf(
	time: number,
	position: Vector3,
	source: {
		rotation?: Vector3
		speed?: number
		steering?: number
		inputFlags?: number
		soapboxFlags?: number
		groundedWheelState?: number
		slippingWheelState?: number
		surfaceState?: number
		localVelocity?: Vector3
		localAngularVelocity?: Vector3
		localGForce?: Vector2
		parkingBlockState?: boolean
		monorailState?: boolean
		ragdollState?: boolean
		ragdollPosition?: Vector3
		ragdollRotation?: Vector3
	},
	rotation = source.rotation,
): GhostFrame {
	if (!finite(time, position.x, position.y, position.z)) {
		throw new Error('Invalid protobuf ghost frame')
	}
	const inputFlags = source.inputFlags ?? 0
	const soapboxFlags = source.soapboxFlags ?? 0
	const groundedWheelState = source.groundedWheelState
	const slippingWheelState = source.slippingWheelState
	const surfaceState = source.surfaceState ?? SurfaceState.Tarmac
	const hasAnyWheel = (soapboxFlags & (8 | 16 | 32 | 64)) !== 0
	return {
		time,
		position,
		rotation,
		speed: source.speed,
		steering: remapByte(source.steering ?? 128, -1, 1),
		armsUp: (inputFlags & InputFlags.ArmsUp) !== 0,
		braking: (inputFlags & InputFlags.Braking) !== 0,
		horn: (inputFlags & InputFlags.Horn) !== 0,
		soap: (soapboxFlags & SoapboxFlags.Soap) !== 0,
		offroad: (soapboxFlags & SoapboxFlags.Offroad) !== 0,
		paraglider: (soapboxFlags & SoapboxFlags.Paraglider) !== 0,
		inAir: typeof groundedWheelState === 'number' ? groundedWheelState === 0 : !hasAnyWheel,
		wheelState: wheelStateFromSoapboxFlags(soapboxFlags),
		groundedWheelState,
		slippingWheelState,
		surfaceState,
		surfaces: surfacesFromState(surfaceState),
		localVelocity: source.localVelocity
			? unscaleVector3(source.localVelocity, POSITION_MULTIPLIER)
			: undefined,
		localAngularVelocity: source.localAngularVelocity
			? unscaleVector3(source.localAngularVelocity, ROTATION_MULTIPLIER)
			: undefined,
		localGForce: source.localGForce
			? unscaleVector2(source.localGForce, POSITION_MULTIPLIER)
			: undefined,
		parkingBlock: source.parkingBlockState,
		monorail: source.monorailState,
		ragdoll: source.ragdollState,
		ragdollPosition: source.ragdollPosition,
		ragdollRotation: source.ragdollRotation,
	}
}

function requireUnscaledVector3(value: Vector3 | undefined, multiplier: number): Vector3 {
	if (!value) throw new Error('Invalid protobuf ghost ragdoll frame')
	return unscaleVector3(value, multiplier)
}

function addVector3(left: Vector3 | undefined, right: Vector3): Vector3 {
	if (!left) throw new Error('Invalid protobuf ghost ragdoll state')
	return {
		x: left.x + right.x,
		y: left.y + right.y,
		z: left.z + right.z,
	}
}

function unscaleVector3(value: Vector3, multiplier: number): Vector3 {
	return {
		x: value.x / multiplier,
		y: value.y / multiplier,
		z: value.z / multiplier,
	}
}

function unscaleVector2(value: Vector2, multiplier: number): Vector2 {
	return {
		x: value.x / multiplier,
		y: value.y / multiplier,
	}
}

function wheelStateFromSoapboxFlags(soapboxFlags: number): number {
	let value = 0
	if ((soapboxFlags & SoapboxFlags.FrontLeft) !== 0) value |= 1 << 0
	if ((soapboxFlags & SoapboxFlags.FrontRight) !== 0) value |= 1 << 1
	if ((soapboxFlags & SoapboxFlags.RearLeft) !== 0) value |= 1 << 2
	if ((soapboxFlags & SoapboxFlags.RearRight) !== 0) value |= 1 << 3
	return value
}
