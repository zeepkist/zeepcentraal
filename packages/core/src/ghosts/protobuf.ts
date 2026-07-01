import { decompress } from '@napi-rs/lzma/lzma'
import protobuf from 'protobufjs'
import { finite } from '../utils/finite'
import { remapByte } from '../utils/remapByte'
import type { GhostFrame, Vector3 } from './types'

const root = new protobuf.Root()
const vector3Type = new protobuf.Type('Vector3')
	.add(new protobuf.Field('x', 1, 'float'))
	.add(new protobuf.Field('y', 2, 'float'))
	.add(new protobuf.Field('z', 3, 'float'))
const vector3IntType = new protobuf.Type('Vector3Int')
	.add(new protobuf.Field('x', 1, 'int32'))
	.add(new protobuf.Field('y', 2, 'int32'))
	.add(new protobuf.Field('z', 3, 'int32'))
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
const deltaFrameType = new protobuf.Type('DeltaFrame')
	.add(new protobuf.Field('time', 1, 'float'))
	.add(new protobuf.Field('position', 2, 'Vector3Int'))
	.add(new protobuf.Field('rotation', 3, 'Vector3Int'))
	.add(new protobuf.Field('speed', 4, 'uint32'))
	.add(new protobuf.Field('steering', 5, 'uint32'))
	.add(new protobuf.Field('inputFlags', 6, 'int32'))
	.add(new protobuf.Field('soapboxFlags', 7, 'int32'))
const statisticsType = new protobuf.Type('GhostStatistics')
	.add(new protobuf.Field('frameCount', 1, 'int32'))
	.add(new protobuf.Field('duration', 2, 'float'))
	.add(new protobuf.Field('distanceTravelled', 3, 'float'))
	.add(new protobuf.Field('distanceInAir', 4, 'float'))
	.add(new protobuf.Field('distanceOnGround', 5, 'float'))
	.add(new protobuf.Field('timeInAir', 6, 'float'))
	.add(new protobuf.Field('timeOnGround', 7, 'float'))
	.add(new protobuf.Field('averageSpeed', 8, 'float'))
	.add(new protobuf.Field('topSpeed', 9, 'float'))
	.add(new protobuf.Field('armsUpCount', 10, 'int32'))
	.add(new protobuf.Field('armsUpTime', 11, 'float'))
	.add(new protobuf.Field('brakeCount', 12, 'int32'))
	.add(new protobuf.Field('brakeTime', 13, 'float'))
	.add(new protobuf.Field('turnLeftCount', 14, 'int32'))
	.add(new protobuf.Field('turnLeftTime', 15, 'float'))
	.add(new protobuf.Field('turnRightCount', 16, 'int32'))
	.add(new protobuf.Field('turnRightTime', 17, 'float'))
	.add(new protobuf.Field('hornCount', 18, 'int32'))
	.add(new protobuf.Field('hornTime', 19, 'float'))
	.add(new protobuf.Field('soapTime', 20, 'float'))
	.add(new protobuf.Field('offroadTime', 21, 'float'))
	.add(new protobuf.Field('paragliderTime', 22, 'float'))
	.add(new protobuf.MapField('surfaceDistance', 23, 'string', 'float'))
	.add(new protobuf.MapField('surfaceTime', 24, 'string', 'float'))
const ghostType = new protobuf.Type('Ghost')
	.add(new protobuf.Field('version', 1, 'int32'))
	.add(new protobuf.Field('steamId', 2, 'uint64'))
	.add(new protobuf.Field('cosmetics', 3, 'Cosmetics'))
	.add(new protobuf.Field('initialFrame', 4, 'InitialFrame'))
	.add(new protobuf.Field('deltaFrames', 5, 'DeltaFrame', 'repeated'))
	.add(new protobuf.Field('taggedUsername', 6, 'string'))
	.add(new protobuf.Field('color', 7, 'string'))
	.add(new protobuf.Field('statistics', 8, 'GhostStatistics'))

root.define('gtr')
	.add(vector3Type)
	.add(vector3IntType)
	.add(cosmeticsType)
	.add(initialFrameType)
	.add(deltaFrameType)
	.add(statisticsType)
	.add(ghostType)

export type DecodedProtobufGhost = {
	version?: number
	initialFrame?: {
		position?: Vector3
		speed?: number
		steering?: number
		inputFlags?: number
		soapboxFlags?: number
	}
	deltaFrames?: Array<{
		time?: number
		position?: Vector3
		speed?: number
		steering?: number
		inputFlags?: number
		soapboxFlags?: number
	}>
	statistics?: unknown
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
	frames.push(frameFromProtobuf(0, position, decoded.initialFrame))
	for (const deltaFrame of decoded.deltaFrames) {
		const delta = deltaFrame.position
		if (!delta || typeof deltaFrame.time !== 'number') {
			throw new Error('Invalid protobuf ghost frame')
		}
		position = {
			x: position.x + delta.x / 100_000,
			y: position.y + delta.y / 100_000,
			z: position.z + delta.z / 100_000,
		}
		frames.push(frameFromProtobuf(deltaFrame.time, position, deltaFrame))
	}
	return frames
}

function frameFromProtobuf(
	time: number,
	position: Vector3,
	source: {
		speed?: number
		steering?: number
		inputFlags?: number
		soapboxFlags?: number
	},
): GhostFrame {
	if (!finite(time, position.x, position.y, position.z)) {
		throw new Error('Invalid protobuf ghost frame')
	}
	const inputFlags = source.inputFlags ?? 0
	const soapboxFlags = source.soapboxFlags ?? 0
	const hasAnyWheel = (soapboxFlags & (8 | 16 | 32 | 64)) !== 0
	return {
		time,
		position,
		speed: source.speed,
		steering: remapByte(source.steering ?? 128, -1, 1),
		armsUp: (inputFlags & 1) !== 0,
		braking: (inputFlags & 2) !== 0,
		horn: (inputFlags & 4) !== 0,
		soap: (soapboxFlags & 1) !== 0,
		offroad: (soapboxFlags & 2) !== 0,
		paraglider: (soapboxFlags & 4) !== 0,
		inAir: !hasAnyWheel,
	}
}
