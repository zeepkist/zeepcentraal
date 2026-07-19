import type { ParsedGhost } from '@zeepkist/core/ghosts/shared'
import type { ParsedPlaybackGhost } from '~/types/ghost'

type ParseResponse =
	| { id: number; ok: true; ghost: ParsedGhost }
	| { id: number; ok: false; error: string }

type PendingRequest = {
	resolve: (ghost: ParsedPlaybackGhost) => void
	reject: (error: Error) => void
}

let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

function getWorker(): Worker {
	if (worker) return worker
	worker = new Worker(new URL('../workers/ghostParser.worker.ts', import.meta.url), {
		type: 'module',
	})
	worker.onmessage = ({ data }: MessageEvent<ParseResponse>) => {
		const request = pending.get(data.id)
		if (!request) return
		pending.delete(data.id)
		if (data.ok) request.resolve(mapParsedGhost(data.ghost))
		else request.reject(new Error(data.error))
	}
	worker.onerror = (event) => {
		const error = new Error(event.message || 'Ghost parser worker failed')
		for (const request of pending.values()) request.reject(error)
		pending.clear()
		worker?.terminate()
		worker = null
	}
	return worker
}

export function parseGhostInWorker(buffer: ArrayBuffer): Promise<ParsedPlaybackGhost> {
	const id = nextRequestId++
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject })
		getWorker().postMessage({ id, buffer }, [buffer])
	})
}

function mapParsedGhost(ghost: ParsedGhost): ParsedPlaybackGhost {
	return {
		version: ghost.version,
		metadata: ghost.metadata,
		capabilities: {
			inputs: ghost.capabilities.input,
			air: ghost.capabilities.air,
			wheels: ghost.capabilities.wheels,
			slip: ghost.capabilities.slipping,
			state: ghost.capabilities.state,
			surfaces: ghost.capabilities.surfaces,
			velocity: ghost.capabilities.velocity,
			ragdoll: ghost.capabilities.ragdoll,
			orientation: ghost.capabilities.orientation,
		},
		frames: ghost.frames,
	}
}
