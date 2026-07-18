import { readBinaryGhost } from './binaryFrames'
import { detectGhostCapabilities } from './capabilities'
import type { ParsedGhost } from './types'

export function parseV2(buffer: Uint8Array): ParsedGhost {
	const { metadata, frames } = readBinaryGhost(buffer, 2)
	return {
		version: 2,
		metadata,
		capabilities: detectGhostCapabilities(frames),
		frames,
	}
}
