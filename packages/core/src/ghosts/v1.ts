import { readBinaryFrames } from './binaryFrames'
import type { ParsedGhost } from './types'

export function parseV1(buffer: Buffer): ParsedGhost {
	return {
		version: 1,
		frames: readBinaryFrames(buffer, 1),
	}
}
