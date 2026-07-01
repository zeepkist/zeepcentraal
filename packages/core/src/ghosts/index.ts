import { gunzipSync } from 'node:zlib'
import { isGzip } from '../utils/isGzip'
import { decodeProtobufGhost } from './protobuf'
import { calculateGhostStatistics } from './statistics'
import type { GhostStatisticValues, ParsedGhost, ParseStatisticsOptions } from './types'
import { parseV1 } from './v1'
import { parseV2 } from './v2'
import { parseV3 } from './v3'
import { parseV4 } from './v4'
import { parseDecodedV5 } from './v5'
import { parseDecodedV6 } from './v6'

export { calculateGhostStatistics, validateGhostStatisticPayload } from './statistics'
export type { GhostFrame, GhostStatisticValues, ParsedGhost, ParseStatisticsOptions } from './types'
export { parseV1 } from './v1'
export { parseV2 } from './v2'
export { parseV3 } from './v3'
export { parseV4 } from './v4'
export { parseV5 } from './v5'
export { parseV6 } from './v6'

export function parseGhost(buffer: Buffer, options?: ParseStatisticsOptions): ParsedGhost {
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

	const decoded = decodeProtobufGhost(buffer)
	switch (decoded.version) {
		case 5:
			return parseDecodedV5(decoded)
		case 6:
			return parseDecodedV6(decoded, options)
		default:
			throw new Error(`Unsupported protobuf ghost version ${decoded.version}`)
	}
}

export function parseGhostStatistics(
	buffer: Buffer,
	options?: ParseStatisticsOptions,
): GhostStatisticValues | undefined {
	const ghost = parseGhost(buffer, options)
	if (ghost.version === 6) {
		return ghost.statistics
	}
	if (options?.deriveLegacy) {
		return calculateGhostStatistics(ghost.frames)
	}
	return undefined
}

export function parseGhostStatisticsFromBase64(
	ghostData: string,
	options?: ParseStatisticsOptions,
): GhostStatisticValues | undefined {
	return parseGhostStatistics(Buffer.from(ghostData, 'base64'), options)
}
