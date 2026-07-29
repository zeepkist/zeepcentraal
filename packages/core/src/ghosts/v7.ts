import type { DecodedProtobufGhost } from './protobuf'
import { decodeNativeProtobufGhost } from './protobufNative'
import { parseDecodedV7 } from './protobufVersions'
import type { ParsedGhost } from './types'

export async function parseV7(buffer: Uint8Array): Promise<ParsedGhost> {
	return parseDecodedV7(await decodeNativeProtobufGhost(buffer))
}

export type { DecodedProtobufGhost }
export { parseDecodedV7 }
