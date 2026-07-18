import { describe, expect, test } from 'bun:test'
import protobuf from 'protobufjs'
import { parseGhostBrowser } from './browser'
import { decodeProtobufGhostPayload, readProtobufMetadata } from './protobuf'
import { parseV1 } from './v1'
import { parseV4 } from './v4'

function createV1Ghost(rotation: [number, number, number]): Uint8Array {
	const buffer = new Uint8Array(36)
	const view = new DataView(buffer.buffer)
	view.setInt32(0, 1, true)
	view.setInt32(4, 1, true)
	view.setFloat32(8, 0, true)
	view.setFloat32(12, 1, true)
	view.setFloat32(16, 2, true)
	view.setFloat32(20, 3, true)
	view.setFloat32(24, rotation[0], true)
	view.setFloat32(28, rotation[1], true)
	view.setFloat32(32, rotation[2], true)
	return buffer
}

function createV4Ghost(): Uint8Array {
	const buffer = new Uint8Array(55)
	const view = new DataView(buffer.buffer)
	let offset = 0
	view.setInt32(offset, 4, true)
	offset += 4
	view.setBigUint64(offset, 76_561_198_031_919_228n, true)
	offset += 8
	for (const cosmetic of [11, 22, 33]) {
		view.setInt32(offset, cosmetic, true)
		offset += 4
	}
	view.setUint8(offset++, 1)
	view.setInt32(offset, 1, true)
	offset += 4
	view.setFloat32(offset, 0, true)
	offset += 4
	for (const position of [1, 2, 3]) {
		view.setFloat32(offset, position, true)
		offset += 4
	}
	for (const rotation of [0, 7_071, 0, 7_071]) {
		view.setInt16(offset, rotation, true)
		offset += 2
	}
	view.setUint8(offset++, 128)
	view.setUint8(offset, 0)
	return buffer
}

function createProtobufMetadataPayload(): Uint8Array {
	const root = new protobuf.Root()
	const cosmetics = new protobuf.Type('Cosmetics')
		.add(new protobuf.Field('zeepkist', 1, 'int32'))
		.add(new protobuf.Field('frontWheels', 2, 'int32'))
		.add(new protobuf.Field('rearWheels', 3, 'int32'))
		.add(new protobuf.Field('paraglider', 4, 'int32'))
		.add(new protobuf.Field('horn', 5, 'int32'))
		.add(new protobuf.Field('hat', 6, 'int32'))
		.add(new protobuf.Field('glasses', 7, 'int32'))
		.add(new protobuf.Field('colorBody', 8, 'int32'))
		.add(new protobuf.Field('colorLeftArm', 9, 'int32'))
		.add(new protobuf.Field('colorRightArm', 10, 'int32'))
		.add(new protobuf.Field('colorLeftLeg', 11, 'int32'))
		.add(new protobuf.Field('colorRightLeg', 12, 'int32'))
		.add(new protobuf.Field('color', 13, 'int32'))
	const ghost = new protobuf.Type('Ghost')
		.add(new protobuf.Field('version', 1, 'int32'))
		.add(new protobuf.Field('steamId', 2, 'uint64'))
		.add(new protobuf.Field('cosmetics', 3, 'Cosmetics'))
		.add(new protobuf.Field('taggedUsername', 6, 'string'))
		.add(new protobuf.Field('color', 7, 'string'))
	root.define('test').add(cosmetics).add(ghost)
	return ghost
		.encode(
			ghost.fromObject({
				version: 6,
				steamId: '76561198031919228',
				taggedUsername: '<color=#fff>Player',
				color: '#a1b2c3d4',
				cosmetics: {
					zeepkist: 1,
					frontWheels: 2,
					rearWheels: 3,
					paraglider: 4,
					horn: 5,
					hat: 6,
					glasses: 7,
					colorBody: 8,
					colorLeftArm: 9,
					colorRightArm: 10,
					colorLeftLeg: 11,
					colorRightLeg: 12,
					color: 13,
				},
			}),
		)
		.finish()
}

describe('ghost playback parsing', () => {
	test('preserves legacy Euler rotation and exposes normalized orientation', () => {
		const ghost = parseV1(createV1Ghost([0, 90, 0]))

		expect(ghost.frames[0]?.rotation).toEqual({ x: 0, y: 90, z: 0 })
		expect(ghost.frames[0]?.orientation?.x).toBeCloseTo(0)
		expect(ghost.frames[0]?.orientation?.y).toBeCloseTo(Math.SQRT1_2)
		expect(ghost.frames[0]?.orientation?.z).toBeCloseTo(0)
		expect(ghost.frames[0]?.orientation?.w).toBeCloseTo(Math.SQRT1_2)
		expect(ghost.capabilities.orientation).toBe(true)
	})

	test('decodes V4 quaternion and legacy identity without losing uint64 precision', () => {
		const ghost = parseV4(createV4Ghost())

		expect(ghost.metadata).toMatchObject({
			steamId: '76561198031919228',
			color: null,
			cosmetics: { zeepkist: 11, hat: 22, color: 33 },
		})
		expect(ghost.frames[0]?.orientation?.y).toBeCloseTo(Math.SQRT1_2, 3)
		expect(ghost.frames[0]?.orientation?.w).toBeCloseTo(Math.SQRT1_2, 3)
	})

	test('decodes current protobuf metadata field numbers and exact Steam ID', () => {
		const decoded = decodeProtobufGhostPayload(createProtobufMetadataPayload())

		expect(readProtobufMetadata(decoded)).toEqual({
			steamId: '76561198031919228',
			taggedUsername: '<color=#fff>Player',
			color: '#A1B2C3D4',
			cosmetics: {
				zeepkist: 1,
				frontWheels: 2,
				rearWheels: 3,
				paraglider: 4,
				horn: 5,
				hat: 6,
				glasses: 7,
				colorBody: 8,
				colorLeftArm: 9,
				colorRightArm: 10,
				colorLeftLeg: 11,
				colorRightLeg: 12,
				color: 13,
			},
		})
	})

	test('rejects an already-rounded numeric protobuf Steam ID', () => {
		expect(readProtobufMetadata({ steamId: Number('76561198031919228') }).steamId).toBeNull()
	})

	test('uses browser parser for raw and injected-gzip legacy payloads', async () => {
		const payload = createV1Ghost([1, 2, 3])
		const decompressLzma = async () => {
			throw new Error('unexpected LZMA')
		}

		const raw = await parseGhostBrowser(payload, { decompressLzma })
		const gzip = await parseGhostBrowser(new Uint8Array([0x1f, 0x8b]), {
			decompressLzma,
			decompressGzip: async () => payload,
		})

		expect(raw.frames[0]?.rotation).toEqual({ x: 1, y: 2, z: 3 })
		expect(gzip.frames[0]?.rotation).toEqual({ x: 1, y: 2, z: 3 })
	})
})
