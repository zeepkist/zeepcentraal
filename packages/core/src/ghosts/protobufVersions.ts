import { detectGhostCapabilities } from './capabilities'
import type { DecodedProtobufGhost } from './protobuf'
import { readProtobufFrames, readProtobufMetadata } from './protobuf'
import type { ParsedGhost } from './types'

export function parseDecodedV5(decoded: DecodedProtobufGhost): ParsedGhost {
	if (decoded.version !== 5) {
		throw new Error(`Invalid V5 ghost version ${decoded.version}`)
	}
	return parseDecodedProtobufGhost(decoded, 5)
}

export function parseDecodedV6(decoded: DecodedProtobufGhost): ParsedGhost {
	if (decoded.version !== 6) {
		throw new Error(`Invalid V6 ghost version ${decoded.version}`)
	}
	return parseDecodedProtobufGhost(decoded, 6)
}

export function parseDecodedV7(decoded: DecodedProtobufGhost): ParsedGhost {
	if (decoded.version !== 7) {
		throw new Error(`Invalid V7 ghost version ${decoded.version}`)
	}
	return parseDecodedProtobufGhost(decoded, 7)
}

function parseDecodedProtobufGhost(decoded: DecodedProtobufGhost, version: 5 | 6 | 7): ParsedGhost {
	const frames = readProtobufFrames(decoded)
	return {
		version,
		metadata: readProtobufMetadata(decoded),
		capabilities: detectGhostCapabilities(frames, version),
		frames,
	}
}
