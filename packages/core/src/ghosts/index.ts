import { detectGhostCapabilities } from './capabilities'
import { decompressGhostPayload } from './compression'
import { assertGhostCompressedSize } from './limits'
import { normalizeGhostColor } from './metadata'
import { normalizeQuaternion, unityEulerToQuaternion } from './orientation'
import { type DecodedProtobufGhost, iterateProtobufFrames } from './protobuf'
import { decodeNativeProtobufGhost } from './protobufNative'
import { calculateGhostStatistics, calculateGhostStatisticsFromIterable } from './statistics'
import type { GhostStatisticValues, ParsedGhost } from './types'
import { parseV1 } from './v1'
import { parseV2 } from './v2'
import { parseV3 } from './v3'
import { parseV4 } from './v4'
import { parseDecodedV5 } from './v5'
import { parseDecodedV6 } from './v6'
import { parseDecodedV7 } from './v7'

export { TURN_DEADZONE } from './constants'
export {
	GroundedWheelState,
	InputFlags,
	MaterialPhysicsState,
	SlippingWheelState,
	SoapboxFlags,
	WheelFlags,
} from './enums'
export {
	GhostLimitError,
	MAX_GHOST_COMPRESSED_BYTES,
	MAX_GHOST_DECOMPRESSED_BYTES,
	MAX_GHOST_FRAMES,
} from './limits'
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
export { parseV7 } from './v7'
export { detectGhostCapabilities, normalizeGhostColor, normalizeQuaternion, unityEulerToQuaternion }

function parseLegacyGhost(payload: Uint8Array, version: number): ParsedGhost {
	switch (version) {
		case 1:
			return parseV1(payload)
		case 2:
			return parseV2(payload)
		case 3:
			return parseV3(payload)
		case 4:
			return parseV4(payload)
		default:
			throw new Error(`Unsupported legacy ghost version ${version}`)
	}
}

type DecodedGhostSource =
	| { kind: 'legacy'; ghost: ParsedGhost }
	| { kind: 'protobuf'; ghost: DecodedProtobufGhost; version: 5 | 6 | 7 }

async function decodeGhostSource(buffer: Uint8Array): Promise<DecodedGhostSource> {
	assertGhostCompressedSize(buffer.byteLength)
	const payload = await decompressGhostPayload(buffer)
	const version =
		payload.length >= 4
			? new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getInt32(0, true)
			: 0

	if (version >= 1 && version <= 4) {
		return { kind: 'legacy', ghost: parseLegacyGhost(payload, version) }
	}

	const ghost = await decodeNativeProtobufGhost(buffer)
	switch (ghost.version) {
		case 5:
		case 6:
		case 7:
			return { kind: 'protobuf', ghost, version: ghost.version }
		default:
			throw new Error(`Unsupported protobuf ghost version ${ghost.version}`)
	}
}

function parseProtobufGhost(
	source: Extract<DecodedGhostSource, { kind: 'protobuf' }>,
): ParsedGhost {
	switch (source.version) {
		case 5:
			return parseDecodedV5(source.ghost)
		case 6:
			return parseDecodedV6(source.ghost)
		case 7:
			return parseDecodedV7(source.ghost)
	}
}

export async function parseGhost(buffer: Uint8Array): Promise<ParsedGhost> {
	const source = await decodeGhostSource(buffer)
	return source.kind === 'legacy' ? source.ghost : parseProtobufGhost(source)
}

export async function parseGhostStatistics(buffer: Uint8Array): Promise<GhostStatisticValues> {
	const source = await decodeGhostSource(buffer)
	return source.kind === 'legacy'
		? calculateGhostStatistics(source.ghost.frames, source.ghost.version)
		: calculateGhostStatisticsFromIterable(iterateProtobufFrames(source.ghost), source.version)
}

export async function parseGhostStatisticsFromBase64(
	ghostData: string,
): Promise<GhostStatisticValues> {
	return parseGhostStatistics(Uint8Array.fromBase64(ghostData))
}
