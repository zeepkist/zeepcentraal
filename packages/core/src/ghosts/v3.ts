import { readBinaryFrames } from './binaryFrames'
import type { ParsedGhost } from './types'

export function parseV3(buffer: Buffer): ParsedGhost {
	return {
		version: 3,
		frames: readBinaryFrames(buffer, 3),
	}
}
