import { readBinaryGhost } from './binaryFrames'
import { detectGhostCapabilities } from './capabilities'
import type { ParsedGhost } from './types'

export function parseV3(buffer: Uint8Array): ParsedGhost {
	const { metadata, frames } = readBinaryGhost(buffer, 3)
	return {
		version: 3,
		metadata,
		capabilities: detectGhostCapabilities(frames),
		frames,
	}
}
