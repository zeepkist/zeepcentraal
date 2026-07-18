import { isGzip } from '../utils/isGzip'
import { decodeProtobufGhostPayload } from './protobuf'
import { parseDecodedV5, parseDecodedV6 } from './protobufVersions'
import type { ParsedGhost } from './types'
import { parseV1 } from './v1'
import { parseV2 } from './v2'
import { parseV3 } from './v3'
import { parseV4 } from './v4'

export type GhostBrowserDecompressor = (buffer: Uint8Array) => Promise<ArrayBuffer | Uint8Array>

export type GhostBrowserParseOptions = {
	decompressLzma: GhostBrowserDecompressor
	decompressGzip?: GhostBrowserDecompressor
}

export async function parseGhostBrowser(
	input: ArrayBuffer | Uint8Array,
	options: GhostBrowserParseOptions,
): Promise<ParsedGhost> {
	const compressed = asUint8Array(input)
	const payload = isGzip(compressed)
		? asUint8Array(await (options.decompressGzip ?? decompressGzipBrowser)(compressed))
		: compressed
	const rawVersion = readVersion(payload)
	const legacyGhost = parseLegacyGhost(payload, rawVersion)
	if (legacyGhost) return legacyGhost

	const protobufPayload = asUint8Array(await options.decompressLzma(compressed))
	const decoded = decodeProtobufGhostPayload(protobufPayload)
	switch (decoded.version) {
		case 5:
			return parseDecodedV5(decoded)
		case 6:
			return parseDecodedV6(decoded)
		default:
			throw new Error(`Unsupported protobuf ghost version ${decoded.version}`)
	}
}

export async function decompressGzipBrowser(buffer: Uint8Array): Promise<ArrayBuffer> {
	if (typeof DecompressionStream === 'undefined') {
		throw new Error('Browser does not support gzip decompression')
	}
	const source = new Blob([copyArrayBuffer(buffer)]).stream()
	const decompressed = source.pipeThrough(new DecompressionStream('gzip'))
	return new Response(decompressed).arrayBuffer()
}

function parseLegacyGhost(buffer: Uint8Array, version: number): ParsedGhost | null {
	switch (version) {
		case 1:
			return parseV1(buffer)
		case 2:
			return parseV2(buffer)
		case 3:
			return parseV3(buffer)
		case 4:
			return parseV4(buffer)
		default:
			return null
	}
}

function readVersion(buffer: Uint8Array): number {
	if (buffer.byteLength < 4) return 0
	return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getInt32(0, true)
}

function asUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
	return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

function copyArrayBuffer(buffer: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(buffer.byteLength)
	copy.set(buffer)
	return copy.buffer
}
