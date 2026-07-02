import type { DecodedProtobufGhost } from './protobuf'
import { decodeProtobufGhost, readProtobufFrames } from './protobuf'
import type { ParsedGhost } from './types'

export async function parseV6(buffer: Buffer): Promise<ParsedGhost> {
	return parseDecodedV6(await decodeProtobufGhost(buffer))
}

export function parseDecodedV6(decoded: DecodedProtobufGhost): ParsedGhost {
	if (decoded.version !== 6) {
		throw new Error(`Invalid V6 ghost version ${decoded.version}`)
	}
	return {
		version: 6,
		frames: readProtobufFrames(decoded),
	}
}
