import type { DecodedProtobufGhost } from './protobuf'
import { decodeNativeProtobufGhost } from './protobufNative'
import { parseDecodedV5 } from './protobufVersions'
import type { ParsedGhost } from './types'

export async function parseV5(buffer: Uint8Array): Promise<ParsedGhost> {
	return parseDecodedV5(await decodeNativeProtobufGhost(buffer))
}

export type { DecodedProtobufGhost }
export { parseDecodedV5 }
