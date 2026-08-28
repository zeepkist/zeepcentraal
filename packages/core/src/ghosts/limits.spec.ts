import { expect, test } from 'bun:test'
import { decompressGhostPayload } from './compression'
import {
	assertGhostCompressedSize,
	MAX_GHOST_COMPRESSED_BYTES,
	MAX_GHOST_DECOMPRESSED_BYTES,
} from './limits'
import { type DecodedProtobufGhost, iterateProtobufFrames } from './protobuf'

test('rejects oversized compressed ghost before parsing', () => {
	expect(() => assertGhostCompressedSize(MAX_GHOST_COMPRESSED_BYTES + 1)).toThrow(
		'Ghost exceeds 25165824 compressed bytes',
	)
})

test('cancels gzip expansion above decompressed limit', async () => {
	const expanded = new Uint8Array(MAX_GHOST_DECOMPRESSED_BYTES + 1)
	const compressed = Bun.gzipSync(expanded)
	await expect(decompressGhostPayload(compressed)).rejects.toThrow(
		'Ghost exceeds 67108864 decompressed bytes',
	)
})

test('rejects protobuf frame count before iteration', () => {
	const decoded: DecodedProtobufGhost = {
		version: 5,
		initialFrame: { position: { x: 0, y: 0, z: 0 } },
		deltaFrames: new Array(120_000).fill({ time: 1, position: { x: 0, y: 0, z: 0 } }),
	}
	expect(() => iterateProtobufFrames(decoded).next()).toThrow('Ghost exceeds 120000 frames')
})
