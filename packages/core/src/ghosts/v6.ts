import type { DecodedProtobufGhost } from './protobuf'
import { decodeProtobufGhost, readProtobufFrames } from './protobuf'
import { validateGhostStatisticPayload } from './statistics'
import type { ParsedGhost, ParseStatisticsOptions } from './types'

export function parseV6(buffer: Buffer, options?: ParseStatisticsOptions): ParsedGhost {
	return parseDecodedV6(decodeProtobufGhost(buffer), options)
}

export function parseDecodedV6(
	decoded: DecodedProtobufGhost,
	options?: ParseStatisticsOptions,
): ParsedGhost {
	if (decoded.version !== 6) {
		throw new Error(`Invalid V6 ghost version ${decoded.version}`)
	}
	return {
		version: 6,
		frames: readProtobufFrames(decoded),
		statistics: validateGhostStatisticPayload(decoded.statistics, options),
	}
}
