import { finite } from '../utils/finite'
import { BinaryReader } from './binaryReader'
import type { GhostFrame } from './types'

export function readBinaryFrames(buffer: Buffer, version: 1 | 2 | 3): GhostFrame[] {
	const reader = new BinaryReader(buffer)
	reader.readInt32()
	if (version >= 2) {
		reader.readUInt64()
		reader.readInt32()
		reader.readInt32()
		reader.readInt32()
	}

	const frameCount = reader.readInt32()
	const frames: GhostFrame[] = []
	for (let i = 0; i < frameCount; i++) {
		const time = reader.readFloat()
		const position = { x: reader.readFloat(), y: reader.readFloat(), z: reader.readFloat() }
		reader.readFloat()
		reader.readFloat()
		reader.readFloat()
		if (!finite(time, position.x, position.y, position.z)) {
			throw new Error('Invalid ghost frame')
		}

		const frame: GhostFrame = { time, position }
		if (version >= 3) {
			frame.steering = reader.readFloat()
			if (!Number.isFinite(frame.steering)) {
				throw new Error('Invalid ghost steering')
			}
			frame.armsUp = reader.readBoolean()
			frame.braking = reader.readBoolean()
		}
		frames.push(frame)
	}

	return frames
}
