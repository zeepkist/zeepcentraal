import { parseGhostBrowser } from '@zeepkist/core/ghosts/browser'
import type { ParsedGhost } from '@zeepkist/core/ghosts/shared'
import { decompress, initWasm } from 'lzma-wasm'

type ParseRequest = {
	id: number
	buffer: ArrayBuffer
}

type ParseResponse =
	| { id: number; ok: true; ghost: ParsedGhost }
	| { id: number; ok: false; error: string }

let wasmPromise: Promise<unknown> | null = null
let parseQueue: Promise<void> = Promise.resolve()

self.onmessage = ({ data }: MessageEvent<ParseRequest>) => {
	parseQueue = parseQueue.then(
		() => parseRequest(data),
		() => parseRequest(data),
	)
}

async function parseRequest(data: ParseRequest) {
	try {
		const ghost = await parseGhostBrowser(data.buffer, {
			decompressLzma: async (buffer) => {
				wasmPromise ??= initWasm()
				await wasmPromise
				return decompress(buffer, { memLimit: 256 * 1024 * 1024 })
			},
		})
		self.postMessage({ id: data.id, ok: true, ghost } satisfies ParseResponse)
	} catch (error) {
		self.postMessage({
			id: data.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		} satisfies ParseResponse)
	}
}
