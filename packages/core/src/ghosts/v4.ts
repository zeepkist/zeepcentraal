import { finite } from '../utils/finite'
import { remapByte } from '../utils/remapByte'
import { BinaryReader } from './binaryReader'
import type { GhostFrame, ParsedGhost, Vector3 } from './types'

export function parseV4(buffer: Buffer): ParsedGhost {
	return {
		version: 4,
		frames: readV4Frames(buffer),
	}
}

function readV4Frames(buffer: Buffer): GhostFrame[] {
	const reader = new BinaryReader(buffer)
	reader.readInt32()
	reader.readUInt64()
	reader.readInt32()
	reader.readInt32()
	reader.readInt32()
	const precision = reader.readByte()
	if (precision === 0) {
		throw new Error('Invalid V4 ghost precision')
	}
	const frameCount = reader.readInt32()
	const frames: GhostFrame[] = []
	let currentPosition: Vector3 | null = null

	for (let i = 0; i < frameCount; i++) {
		const full: boolean =
			i % precision === 0 || i === frameCount - 1 || currentPosition === null
		const time = reader.readFloat()
		let position: Vector3
		if (full || currentPosition === null) {
			position = { x: reader.readFloat(), y: reader.readFloat(), z: reader.readFloat() }
		} else {
			position = {
				x: currentPosition.x + reader.readInt16() / 10_000,
				y: currentPosition.y + reader.readInt16() / 10_000,
				z: currentPosition.z + reader.readInt16() / 10_000,
			}
		}
		reader.readInt16()
		reader.readInt16()
		reader.readInt16()
		reader.readInt16()
		const steering = remapByte(reader.readByte(), -1, 1)
		const flags = reader.readByte()
		if (!finite(time, position.x, position.y, position.z)) {
			throw new Error('Invalid V4 ghost frame')
		}
		currentPosition = position
		frames.push({
			time,
			position,
			steering,
			armsUp: (flags & 1) !== 0,
			braking: (flags & 2) !== 0,
		})
	}

	return frames
}
