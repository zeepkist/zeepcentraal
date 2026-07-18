import { gunzipSync } from 'node:zlib'
import { isGzip } from '../utils/isGzip'
import { detectGhostCapabilities } from './capabilities'
import { normalizeGhostColor } from './metadata'
import { normalizeQuaternion, unityEulerToQuaternion } from './orientation'
import { decodeNativeProtobufGhost } from './protobufNative'
import { calculateGhostStatistics } from './statistics'
import type { GhostStatisticValues, ParsedGhost } from './types'
import { parseV1 } from './v1'
import { parseV2 } from './v2'
import { parseV3 } from './v3'
import { parseV4 } from './v4'
import { parseDecodedV5 } from './v5'
import { parseDecodedV6 } from './v6'

export { TURN_DEADZONE } from './constants'
export {
	GroundedWheelState,
	InputFlags,
	SlippingWheelState,
	SoapboxFlags,
	SurfaceState,
	WheelFlags,
} from './enums'
export { calculateGhostStatistics, emptyGhostStatistics } from './statistics'
export type {
	GhostCapabilities,
	GhostCosmetics,
	GhostFrame,
	GhostMetadata,
	GhostStatisticValues,
	ParsedGhost,
	Quaternion,
	Vector2,
	Vector3,
} from './types'
export { parseV1 } from './v1'
export { parseV2 } from './v2'
export { parseV3 } from './v3'
export { parseV4 } from './v4'
export { parseV5 } from './v5'
export { parseV6 } from './v6'
export { detectGhostCapabilities, normalizeGhostColor, normalizeQuaternion, unityEulerToQuaternion }

export async function parseGhost(buffer: Buffer): Promise<ParsedGhost> {
	const payload = isGzip(buffer) ? gunzipSync(buffer) : buffer
	const rawVersion = payload.length >= 4 ? payload.readInt32LE(0) : 0
	switch (rawVersion) {
		case 1:
			return parseV1(payload)
		case 2:
			return parseV2(payload)
		case 3:
			return parseV3(payload)
		case 4:
			return parseV4(payload)
		default:
			break
	}

	const decoded = await decodeNativeProtobufGhost(buffer)
	switch (decoded.version) {
		case 5:
			return parseDecodedV5(decoded)
		case 6:
			return parseDecodedV6(decoded)
		default:
			throw new Error(`Unsupported protobuf ghost version ${decoded.version}`)
	}
}

export async function parseGhostStatistics(buffer: Buffer): Promise<GhostStatisticValues> {
	const ghost = await parseGhost(buffer)
	return calculateGhostStatistics(ghost.frames, ghost.version)
}

export async function parseGhostStatisticsFromBase64(
	ghostData: string,
): Promise<GhostStatisticValues> {
	return parseGhostStatistics(Buffer.from(ghostData, 'base64'))
}
