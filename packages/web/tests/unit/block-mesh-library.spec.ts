import { MeshoptEncoder } from 'meshoptimizer/encoder'
import { describe, expect, it, vi } from 'vitest'
import {
	ProtectedMeshLibrary,
	parseProtectedGhostModelBundle,
	parseProtectedLevelMeshBundle,
} from '../../app/utils/protectedMeshLibrary.client'
import {
	GHOST_MODEL_SLOTS,
	PROTECTED_MESH_BUNDLE_MAGIC,
	PROTECTED_MESH_BUNDLE_VERSION,
	PROTECTED_MESH_GROUP_FLAGS,
	PROTECTED_MESH_PRIMITIVE_MAGIC,
	PROTECTED_MESH_PRIMITIVE_VERSION,
} from '../../shared/protectedMeshFormat'

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

describe('ProtectedMeshLibrary', () => {
	it('loads authenticated terrain and anonymous soapbox models once each', async () => {
		await MeshoptEncoder.ready
		const requests = new Map<string, number>()
		const library = new ProtectedMeshLibrary({
			fetch: async (url, init) => {
				const path = String(url)
				requests.set(path, (requests.get(path) ?? 0) + 1)
				if (path === '/api/ghost-playback-models') {
					expect(init).toMatchObject({ credentials: 'omit' })
					return new Response(fixtureGhostModelBundle(), { status: 200 })
				}
				expect(path).toBe('/api/ghost-playback-assets/1490')
				expect(init).toMatchObject({ credentials: 'include' })
				return new Response(fixtureLevelBundle(), { status: 200 })
			},
		})

		const [first, second, ghostModels, repeatedGhostModels] = await Promise.all([
			library.load(1490),
			library.load(1490),
			library.loadGhostModels(),
			library.loadGhostModels(),
		])

		expect(requests).toEqual(
			new Map([
				['/api/ghost-playback-assets/1490', 1],
				['/api/ghost-playback-models', 1],
			]),
		)
		expect(first).toBe(second)
		expect(ghostModels).toBe(repeatedGhostModels)
		expect(first.groups).toHaveLength(1)
		expect(first.groups[0]?.matrices).toHaveLength(1)
		expect(first.groups[0]?.color).toEqual([1, 128 / 255, 0])
		expect(first.fallbackMatrices).toHaveLength(1)
		expect(first.groups[0]?.primitives[0]?.geometry.getAttribute('position').count).toBe(3)
		expect(ghostModels.body.getAttribute('position').count).toBe(3)
		library.dispose()
	})

	it('reports failures, permits login retry, and rejects malformed bundles', async () => {
		await MeshoptEncoder.ready
		const reportFallback = vi.fn()
		let attempts = 0
		const library = new ProtectedMeshLibrary({
			fetch: async () => {
				attempts += 1
				return attempts === 1
					? new Response('', { status: 401 })
					: new Response(fixtureLevelBundle(), { status: 200 })
			},
			reportFallback,
		})

		await expect(library.load(1)).rejects.toThrow('Protected mesh request failed: 401')
		await expect(library.load(1)).resolves.toMatchObject({ groups: [{ matrices: [{}] }] })
		expect(attempts).toBe(2)
		expect(reportFallback).toHaveBeenCalledOnce()
		expect(() => parseProtectedLevelMeshBundle(new Uint8Array(52))).toThrow(
			'Invalid mesh bundle magic',
		)
		expect(() => parseProtectedGhostModelBundle(fixtureLevelBundle())).toThrow(
			'Ghost model bundle contains level geometry',
		)
		const versionTwo = fixtureLevelBundle()
		new DataView(versionTwo.buffer).setUint16(4, 2, true)
		expect(() => parseProtectedLevelMeshBundle(versionTwo)).toThrow(
			'Unsupported mesh bundle version',
		)
		const invalidFlags = fixtureLevelBundle()
		new DataView(invalidFlags.buffer).setUint8(52 + 11, 1 << 7)
		expect(() => parseProtectedLevelMeshBundle(invalidFlags)).toThrow(
			'Invalid protected mesh group flags',
		)
		library.dispose()
	})

	it('reflects flagged geometry while keeping primitive matrices positive', async () => {
		await MeshoptEncoder.ready
		const bundle = parseProtectedLevelMeshBundle(fixtureLevelBundle(true))
		const primitive = bundle.groups[0]?.primitives[0]
		const position = primitive?.geometry.getAttribute('position')

		expect(position?.getX(1)).toBeCloseTo(-1)
		expect(Array.from(primitive?.geometry.getIndex()?.array ?? [])).toEqual([0, 2, 1])
		expect(primitive?.matrix.determinant()).toBeGreaterThan(0)
	})
})

function fixtureLevelBundle(reflectX = false) {
	return fixtureBundle(true, false, reflectX)
}

function fixtureGhostModelBundle() {
	return fixtureBundle(false, true)
}

function fixtureBundle(includeLevel: boolean, includeCommon: boolean, reflectX = false) {
	const primitive = fixturePrimitive()
	const headerSize = 52
	const groupSize = includeLevel ? 12 + primitive.byteLength + 64 : 0
	const fallbackSize = includeLevel ? 64 : 0
	const commonEntries = includeCommon ? Object.values(GHOST_MODEL_SLOTS) : []
	const commonSize = commonEntries.length * (8 + primitive.byteLength)
	const bytes = new Uint8Array(headerSize + groupSize + fallbackSize + commonSize)
	const view = new DataView(bytes.buffer)
	let offset = 0
	view.setUint32(offset, PROTECTED_MESH_BUNDLE_MAGIC, true)
	offset += 4
	view.setUint16(offset, PROTECTED_MESH_BUNDLE_VERSION, true)
	offset += 4 + 32
	view.setUint32(offset, includeLevel ? 1 : 0, true)
	view.setUint32(offset + 4, includeLevel ? 1 : 0, true)
	view.setUint32(offset + 8, commonEntries.length, true)
	offset += 12
	if (includeLevel) {
		view.setUint32(offset, primitive.byteLength, true)
		view.setUint32(offset + 4, 1, true)
		view.setUint8(offset + 8, 255)
		view.setUint8(offset + 9, 128)
		view.setUint8(offset + 10, 0)
		view.setUint8(
			offset + 11,
			PROTECTED_MESH_GROUP_FLAGS.hasColor |
				(reflectX ? PROTECTED_MESH_GROUP_FLAGS.reflectX : 0),
		)
		offset += 12
		bytes.set(primitive, offset)
		offset += primitive.byteLength
		offset = writeMatrix(view, offset)
		offset = writeMatrix(view, offset)
	}
	for (const slot of commonEntries) {
		view.setUint8(offset, slot)
		view.setUint32(offset + 4, primitive.byteLength, true)
		offset += 8
		bytes.set(primitive, offset)
		offset += primitive.byteLength
	}
	return bytes
}

function fixturePrimitive() {
	const positions = new Uint16Array([0, 0, 0, 0, 65_535, 0, 0, 0, 0, 65_535, 0, 0])
	const normals = new Float32Array([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1])
	const octahedral = MeshoptEncoder.encodeFilterOct(normals, 3, 8, 16)
	const encodedPositions = MeshoptEncoder.encodeVertexBuffer(
		new Uint8Array(positions.buffer),
		3,
		8,
	)
	const encodedNormals = MeshoptEncoder.encodeVertexBuffer(octahedral, 3, 8)
	const indices = new Uint16Array([0, 1, 2])
	const encodedIndices = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(indices.buffer), 3, 2)
	const headerSize = 8 + 64 + 20 + 4 + 24
	const bytes = new Uint8Array(
		headerSize +
			encodedPositions.byteLength +
			encodedNormals.byteLength +
			encodedIndices.byteLength,
	)
	const view = new DataView(bytes.buffer)
	let offset = 0
	view.setUint32(offset, PROTECTED_MESH_PRIMITIVE_MAGIC, true)
	view.setUint16(offset + 4, PROTECTED_MESH_PRIMITIVE_VERSION, true)
	view.setUint16(offset + 6, 1, true)
	offset = 8
	offset = writeMatrix(view, offset)
	for (const value of [
		3,
		3,
		encodedPositions.byteLength,
		encodedNormals.byteLength,
		encodedIndices.byteLength,
	]) {
		view.setUint32(offset, value, true)
		offset += 4
	}
	view.setUint8(offset, 2)
	offset += 4
	for (const value of [0, 0, 0, 1, 1, 0]) {
		view.setFloat32(offset, value, true)
		offset += 4
	}
	for (const payload of [encodedPositions, encodedNormals, encodedIndices]) {
		bytes.set(payload, offset)
		offset += payload.byteLength
	}
	return bytes
}

function writeMatrix(view: DataView, offset: number) {
	let cursor = offset
	for (const value of identity) {
		view.setFloat32(cursor, value, true)
		cursor += 4
	}
	return cursor
}
