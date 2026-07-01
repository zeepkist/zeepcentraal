import type { DecodedProtobufGhost } from './protobuf'
import { decodeProtobufGhost, readProtobufFrames } from './protobuf'
import type { ParsedGhost } from './types'

export async function parseV5(buffer: Buffer): Promise<ParsedGhost> {
	return parseDecodedV5(await decodeProtobufGhost(buffer))
}

export function parseDecodedV5(decoded: DecodedProtobufGhost): ParsedGhost {
	if (decoded.version !== 5) {
		throw new Error(`Invalid V5 ghost version ${decoded.version}`)
	}
	return {
		version: 5,
		frames: readProtobufFrames(decoded),
	}
}
