import type { DecodedProtobufGhost } from './protobuf'
import { decodeNativeProtobufGhost } from './protobufNative'
import { parseDecodedV6 } from './protobufVersions'
import type { ParsedGhost } from './types'

export async function parseV6(buffer: Uint8Array): Promise<ParsedGhost> {
	return parseDecodedV6(await decodeNativeProtobufGhost(buffer))
}

export type { DecodedProtobufGhost }
export { parseDecodedV6 }
