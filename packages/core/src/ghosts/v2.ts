import { readBinaryFrames } from './binaryFrames'
import type { ParsedGhost } from './types'

export function parseV2(buffer: Buffer): ParsedGhost {
	return {
		version: 2,
		frames: readBinaryFrames(buffer, 2),
	}
}
