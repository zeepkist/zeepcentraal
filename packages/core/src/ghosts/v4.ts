import { finite } from '../utils/finite'
import { remapByte } from '../utils/remapByte'
import { BinaryReader } from './binaryReader'
import { detectGhostCapabilities } from './capabilities'
import { legacyGhostMetadata } from './metadata'
import { normalizeQuaternion } from './orientation'
import type { GhostFrame, ParsedGhost, Quaternion, Vector3 } from './types'

export function parseV4(buffer: Uint8Array): ParsedGhost {
	const { metadata, frames } = readV4Ghost(buffer)
	return {
		version: 4,
		metadata,
		capabilities: detectGhostCapabilities(frames),
		frames,
	}
}

function readV4Ghost(buffer: Uint8Array) {
	const reader = new BinaryReader(buffer)
	reader.readInt32()
	const metadata = legacyGhostMetadata(
		reader.readUInt64(),
		reader.readInt32(),
		reader.readInt32(),
		reader.readInt32(),
	)
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
		const rotationScale = full ? 10_000 : 30_000
		const orientation: Quaternion = normalizeQuaternion({
			x: reader.readInt16() / rotationScale,
			y: reader.readInt16() / rotationScale,
			z: reader.readInt16() / rotationScale,
			w: reader.readInt16() / rotationScale,
		})
		const steering = remapByte(reader.readByte(), -1, 1)
		const flags = reader.readByte()
		if (!finite(time, position.x, position.y, position.z)) {
			throw new Error('Invalid V4 ghost frame')
		}
		currentPosition = position
		frames.push({
			time,
			position,
			orientation,
			steering,
			armsUp: (flags & 1) !== 0,
			braking: (flags & 2) !== 0,
		})
	}

	return { metadata, frames }
}
