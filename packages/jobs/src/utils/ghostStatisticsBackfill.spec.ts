import { describe, expect, test } from 'bun:test'
import { gzipSync } from 'node:zlib'
import { parseGhostStatistics } from '@zeepkist/core/ghosts'
import { buildGhostUrl } from '../tasks/backfillRecordGhostStatistics'

function writeFloat(buffer: Buffer, offset: number, value: number): number {
	buffer.writeFloatLE(value, offset)
	return offset + 4
}

function writeV1Frame(
	buffer: Buffer,
	offset: number,
	time: number,
	position: [number, number, number],
): number {
	let nextOffset = writeFloat(buffer, offset, time)
	for (const value of position) {
		nextOffset = writeFloat(buffer, nextOffset, value)
	}
	for (const value of [0, 0, 0]) {
		nextOffset = writeFloat(buffer, nextOffset, value)
	}
	return nextOffset
}

function createV1Ghost(frames: Array<{ time: number; position: [number, number, number] }>) {
	const buffer = Buffer.alloc(8 + frames.length * 28)
	let offset = 0
	buffer.writeInt32LE(1, offset)
	offset += 4
	buffer.writeInt32LE(frames.length, offset)
	offset += 4
	for (const frame of frames) {
		offset = writeV1Frame(buffer, offset, frame.time, frame.position)
	}
	return buffer
}

function createV3Ghost() {
	const buffer = Buffer.alloc(4 + 8 + 12 + 4 + 2 * 34)
	let offset = 0
	buffer.writeInt32LE(3, offset)
	offset += 4
	buffer.writeBigUInt64LE(1n, offset)
	offset += 8
	for (const value of [1, 2, 3]) {
		buffer.writeInt32LE(value, offset)
		offset += 4
	}
	buffer.writeInt32LE(2, offset)
	offset += 4
	offset = writeV1Frame(buffer, offset, 0, [0, 0, 0])
	offset = writeFloat(buffer, offset, -0.5)
	buffer.writeUInt8(1, offset++)
	buffer.writeUInt8(0, offset++)
	offset = writeV1Frame(buffer, offset, 1, [1, 0, 0])
	offset = writeFloat(buffer, offset, 0.5)
	buffer.writeUInt8(0, offset++)
	buffer.writeUInt8(1, offset++)
	return buffer
}

describe('ghost statistics backfill parser', () => {
	test('builds CDN URL from relative record_media ghost_url', () => {
		expect(buildGhostUrl('ghosts/example.bin')).toBe('https://cdn.zeepki.st/ghosts/example.bin')
	})

	test('parses V1 time and position statistics', async () => {
		const stats = await parseGhostStatistics(
			createV1Ghost([
				{ time: 0, position: [0, 0, 0] },
				{ time: 1, position: [10, 0, 0] },
			]),
		)

		expect(stats?.frameCount).toBe(2)
		expect(stats?.time).toBe(1)
		expect(stats?.distance).toBe(10)
		expect(stats?.averageSpeed).toBe(36)
		expect(stats?.maxSpeed).toBe(36)
		expect(stats?.armsUpCount).toBeNull()
	})

	test('parses gzipped legacy ghosts', async () => {
		const stats = await parseGhostStatistics(
			gzipSync(
				createV1Ghost([
					{ time: 0, position: [0, 0, 0] },
					{ time: 1, position: [1, 0, 0] },
				]),
			),
		)

		expect(stats?.frameCount).toBe(2)
		expect(stats?.distance).toBe(1)
	})

	test('parses V3 input transition statistics', async () => {
		const stats = await parseGhostStatistics(createV3Ghost())

		expect(stats?.armsUpCount).toBe(1)
		expect(stats?.armsUpTime).toBe(1)
		expect(stats?.brakeCount).toBe(1)
		expect(stats?.turnLeftCount).toBe(1)
		expect(stats?.turnRightCount).toBe(1)
	})

	test('ignores movement segment above speed cap', async () => {
		const stats = await parseGhostStatistics(
			createV1Ghost([
				{ time: 0, position: [0, 0, 0] },
				{ time: 1, position: [1_000, 0, 0] },
			]),
		)

		expect(stats?.distance).toBe(0)
		expect(stats?.averageSpeed).toBe(500)
		expect(stats?.maxSpeed).toBe(500)
	})
})
