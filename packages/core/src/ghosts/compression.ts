import { isGzip } from '../utils/isGzip'
import { assertGhostCompressedSize, assertGhostDecompressedSize } from './limits'

export async function decompressGhostPayload(buffer: Uint8Array): Promise<Uint8Array> {
	assertGhostCompressedSize(buffer.byteLength)
	if (!isGzip(buffer)) {
		assertGhostDecompressedSize(buffer.byteLength)
		return buffer
	}

	const input = new Response(buffer).body
	if (!input) throw new Error('Ghost gzip input stream is unavailable')
	const reader = input.pipeThrough(new DecompressionStream('gzip')).getReader()
	const sink = new Bun.ArrayBufferSink()
	sink.start({ asUint8Array: true, highWaterMark: Math.min(buffer.byteLength * 2, 1024 * 1024) })
	let byteLength = 0

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			byteLength += value.byteLength
			assertGhostDecompressedSize(byteLength)
			sink.write(value)
		}
		return sink.end() as Uint8Array
	} catch (error) {
		await reader.cancel(error).catch(() => undefined)
		sink.end()
		throw error
	} finally {
		reader.releaseLock()
	}
}
