import { readBinaryGhost } from './binaryFrames'
import { detectGhostCapabilities } from './capabilities'
import type { ParsedGhost } from './types'

export function parseV1(buffer: Uint8Array): ParsedGhost {
	const { metadata, frames } = readBinaryGhost(buffer, 1)
	return {
		version: 1,
		metadata,
		capabilities: detectGhostCapabilities(frames),
		frames,
	}
}
