import { decompress } from '@napi-rs/lzma/lzma'
import { assertGhostCompressedSize, assertGhostDecompressedSize } from './limits'
import type { DecodedProtobufGhost } from './protobuf'
import { decodeProtobufGhostPayload } from './protobuf'

export async function decodeNativeProtobufGhost(buffer: Uint8Array): Promise<DecodedProtobufGhost> {
	assertGhostCompressedSize(buffer.byteLength)
	const decompressed = await decompress(buffer)
	assertGhostDecompressedSize(decompressed.byteLength)
	return decodeProtobufGhostPayload(decompressed)
}
