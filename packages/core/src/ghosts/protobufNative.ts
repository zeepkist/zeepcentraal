import { decompress } from '@napi-rs/lzma/lzma'
import type { DecodedProtobufGhost } from './protobuf'
import { decodeProtobufGhostPayload } from './protobuf'

export async function decodeNativeProtobufGhost(buffer: Uint8Array): Promise<DecodedProtobufGhost> {
	const decompressed = await decompress(buffer)
	return decodeProtobufGhostPayload(decompressed)
}
