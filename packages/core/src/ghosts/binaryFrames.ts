import { finite } from '../utils/finite'
import { BinaryReader } from './binaryReader'
import { assertGhostFrameCount } from './limits'
import { emptyGhostMetadata, legacyGhostMetadata } from './metadata'
import { unityEulerToQuaternion } from './orientation'
import type { GhostFrame, GhostMetadata } from './types'

export type LegacyBinaryGhost = {
	metadata: GhostMetadata
	frames: GhostFrame[]
}

export function readBinaryGhost(buffer: Uint8Array, version: 1 | 2 | 3): LegacyBinaryGhost {
	const reader = new BinaryReader(buffer)
	reader.readInt32()
	let metadata = emptyGhostMetadata()
	if (version >= 2) {
		metadata = legacyGhostMetadata(
			reader.readUInt64(),
			reader.readInt32(),
			reader.readInt32(),
			reader.readInt32(),
		)
	}

	const frameCount = reader.readInt32()
	assertGhostFrameCount(frameCount)
	const frames: GhostFrame[] = []
	for (let i = 0; i < frameCount; i++) {
		const time = reader.readFloat()
		const position = { x: reader.readFloat(), y: reader.readFloat(), z: reader.readFloat() }
		const rotation = { x: reader.readFloat(), y: reader.readFloat(), z: reader.readFloat() }
		if (!finite(time, position.x, position.y, position.z, rotation.x, rotation.y, rotation.z)) {
			throw new Error('Invalid ghost frame')
		}

		const frame: GhostFrame = {
			time,
			position,
			rotation,
			orientation: unityEulerToQuaternion(rotation),
		}
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

	return { metadata, frames }
}
