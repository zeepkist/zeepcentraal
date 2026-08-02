import { MeshoptDecoder } from 'meshoptimizer/decoder'
import * as THREE from 'three'
import {
	GHOST_MODEL_SLOTS,
	type GhostModelSlot,
	PROTECTED_MESH_BUNDLE_MAGIC,
	PROTECTED_MESH_BUNDLE_VERSION,
	PROTECTED_MESH_PRIMITIVE_MAGIC,
	PROTECTED_MESH_PRIMITIVE_VERSION,
} from '../../shared/protectedMeshFormat'

export type ProtectedMeshPrimitive = {
	geometry: THREE.BufferGeometry
	matrix: THREE.Matrix4
}

export type ProtectedMeshGroup = {
	primitives: ProtectedMeshPrimitive[]
	matrices: THREE.Matrix4[]
	color: [number, number, number] | null
}

export type GhostSoapboxGeometries = {
	axles: THREE.BufferGeometry
	body: THREE.BufferGeometry
	character: THREE.BufferGeometry
	wheel: THREE.BufferGeometry
}

export type ProtectedLevelMeshBundle = {
	groups: ProtectedMeshGroup[]
	fallbackMatrices: THREE.Matrix4[]
}

export type ProtectedMeshLibraryOptions = {
	fetch?: typeof globalThis.fetch
	reportFallback?: (error: unknown) => void
}

const MAXIMUM_BUNDLE_BYTES = 64 * 1024 * 1024
const MAXIMUM_COLLECTION_COUNT = 100_000

export class ProtectedMeshLibrary {
	private readonly fetchImplementation: typeof globalThis.fetch
	private readonly reportFallback: (error: unknown) => void
	private readonly promises = new Map<number, Promise<ProtectedLevelMeshBundle>>()
	private readonly bundles = new Set<ProtectedLevelMeshBundle>()
	private ghostModelsPromise: Promise<GhostSoapboxGeometries> | null = null
	private ghostModels: GhostSoapboxGeometries | null = null
	private disposed = false

	constructor(options: ProtectedMeshLibraryOptions = {}) {
		this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis)
		this.reportFallback =
			options.reportFallback ??
			((error) => console.warn('Protected mesh bundle unavailable.', error))
	}

	load(levelId: number) {
		const cached = this.promises.get(levelId)
		if (cached) return cached
		const promise = this.fetchImplementation(
			`/api/ghost-playback-assets/${encodeURIComponent(levelId)}`,
			{
				credentials: 'include',
				headers: { accept: 'application/vnd.zeepcentraal.mesh-bundle' },
			},
		)
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`Protected mesh request failed: ${response.status}`)
				const bytes = new Uint8Array(await response.arrayBuffer())
				if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_BUNDLE_BYTES) {
					throw new Error('Protected mesh bundle has invalid size')
				}
				await MeshoptDecoder.ready
				const bundle = parseProtectedLevelMeshBundle(bytes)
				if (this.disposed) {
					disposeLevelBundle(bundle)
					throw new Error('Protected mesh library is disposed')
				}
				this.bundles.add(bundle)
				return bundle
			})
			.catch((error: unknown) => {
				this.promises.delete(levelId)
				this.reportFallback(error)
				throw error
			})
		this.promises.set(levelId, promise)
		return promise
	}

	loadGhostModels() {
		if (this.ghostModelsPromise) return this.ghostModelsPromise
		const promise = this.fetchImplementation('/api/ghost-playback-models', {
			credentials: 'omit',
			headers: { accept: 'application/vnd.zeepcentraal.mesh-bundle' },
		})
			.then(async (response) => {
				if (!response.ok) throw new Error(`Ghost model request failed: ${response.status}`)
				const bytes = new Uint8Array(await response.arrayBuffer())
				if (bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_BUNDLE_BYTES) {
					throw new Error('Ghost model bundle has invalid size')
				}
				await MeshoptDecoder.ready
				const ghostModels = parseProtectedGhostModelBundle(bytes)
				if (this.disposed) {
					disposeGhostModels(ghostModels)
					throw new Error('Protected mesh library is disposed')
				}
				this.ghostModels = ghostModels
				return ghostModels
			})
			.catch((error: unknown) => {
				this.ghostModelsPromise = null
				this.reportFallback(error)
				throw error
			})
		this.ghostModelsPromise = promise
		return promise
	}

	dispose() {
		this.disposed = true
		for (const bundle of this.bundles) disposeLevelBundle(bundle)
		if (this.ghostModels) disposeGhostModels(this.ghostModels)
		this.bundles.clear()
		this.promises.clear()
		this.ghostModelsPromise = null
		this.ghostModels = null
	}
}

export function parseProtectedLevelMeshBundle(bytes: Uint8Array): ProtectedLevelMeshBundle {
	const parsed = parseProtectedBundle(bytes)
	for (const geometry of parsed.common.values()) geometry.dispose()
	return { groups: parsed.groups, fallbackMatrices: parsed.fallbackMatrices }
}

export function parseProtectedGhostModelBundle(bytes: Uint8Array): GhostSoapboxGeometries {
	const parsed = parseProtectedBundle(bytes)
	if (parsed.groups.length !== 0 || parsed.fallbackMatrices.length !== 0) {
		for (const group of parsed.groups) {
			for (const primitive of group.primitives) primitive.geometry.dispose()
		}
		for (const geometry of parsed.common.values()) geometry.dispose()
		throw new Error('Ghost model bundle contains level geometry')
	}
	return {
		axles: requireCommon(parsed.common, GHOST_MODEL_SLOTS.axles),
		body: requireCommon(parsed.common, GHOST_MODEL_SLOTS.body),
		character: requireCommon(parsed.common, GHOST_MODEL_SLOTS.character),
		wheel: requireCommon(parsed.common, GHOST_MODEL_SLOTS.wheel),
	}
}

function parseProtectedBundle(bytes: Uint8Array) {
	const reader = new BinaryReader(bytes)
	if (reader.uint32() !== PROTECTED_MESH_BUNDLE_MAGIC)
		throw new Error('Invalid mesh bundle magic')
	if (reader.uint16() !== PROTECTED_MESH_BUNDLE_VERSION) {
		throw new Error('Unsupported mesh bundle version')
	}
	reader.skip(2 + 32)
	const groupCount = reader.count()
	const fallbackCount = reader.count()
	const commonCount = reader.count()
	const groups: ProtectedMeshGroup[] = []
	for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
		const payloadLength = reader.length()
		const matrixCount = reader.count()
		const red = reader.uint8()
		const green = reader.uint8()
		const blue = reader.uint8()
		const hasColor = reader.uint8() !== 0
		const primitives = parsePrimitiveFile(reader.bytes(payloadLength))
		const matrices = Array.from({ length: matrixCount }, () => reader.matrix())
		groups.push({
			primitives,
			matrices,
			color: hasColor ? [red / 255, green / 255, blue / 255] : null,
		})
	}
	const fallbackMatrices = Array.from({ length: fallbackCount }, () => reader.matrix())
	const common = new Map<GhostModelSlot, THREE.BufferGeometry>()
	for (let commonIndex = 0; commonIndex < commonCount; commonIndex += 1) {
		const slot = reader.uint8() as GhostModelSlot
		reader.skip(3)
		const primitives = parsePrimitiveFile(reader.bytes(reader.length()))
		const primitive = primitives[0]
		if (!primitive || primitives.length !== 1) throw new Error('Invalid common mesh payload')
		primitive.geometry.applyMatrix4(primitive.matrix)
		common.set(slot, primitive.geometry)
	}
	reader.finish()
	return { groups, fallbackMatrices, common }
}

function parsePrimitiveFile(bytes: Uint8Array) {
	const reader = new BinaryReader(bytes)
	if (reader.uint32() !== PROTECTED_MESH_PRIMITIVE_MAGIC) {
		throw new Error('Invalid protected primitive magic')
	}
	if (reader.uint16() !== PROTECTED_MESH_PRIMITIVE_VERSION) {
		throw new Error('Unsupported protected primitive version')
	}
	const primitiveCount = reader.count16()
	const primitives: ProtectedMeshPrimitive[] = []
	for (let primitiveIndex = 0; primitiveIndex < primitiveCount; primitiveIndex += 1) {
		const matrix = reader.matrix()
		const vertexCount = reader.count()
		const indexCount = reader.count()
		const positionLength = reader.length()
		const normalLength = reader.length()
		const indexLength = reader.length()
		const indexSize = reader.uint8()
		reader.skip(3)
		if (indexSize !== 2 && indexSize !== 4) throw new Error('Invalid protected index size')
		const minimum = [reader.float32(), reader.float32(), reader.float32()] as const
		const maximum = [reader.float32(), reader.float32(), reader.float32()] as const
		const encodedPositions = reader.bytes(positionLength)
		const encodedNormals = reader.bytes(normalLength)
		const encodedIndices = reader.bytes(indexLength)
		const quantizedPositions = new Uint8Array(vertexCount * 8)
		MeshoptDecoder.decodeVertexBuffer(quantizedPositions, vertexCount, 8, encodedPositions)
		const positionValues = new Uint16Array(quantizedPositions.buffer)
		const positions = new Float32Array(vertexCount * 3)
		for (let index = 0; index < vertexCount; index += 1) {
			for (const axis of [0, 1, 2] as const) {
				const range = maximum[axis] - minimum[axis]
				positions[index * 3 + axis] =
					minimum[axis] + ((positionValues[index * 4 + axis] ?? 0) / 65_535) * range
			}
		}
		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
		if (normalLength > 0) {
			const quantizedNormals = new Uint8Array(vertexCount * 8)
			MeshoptDecoder.decodeVertexBuffer(
				quantizedNormals,
				vertexCount,
				8,
				encodedNormals,
				'OCTAHEDRAL',
			)
			const normalValues = new Int16Array(quantizedNormals.buffer)
			const normals = new Float32Array(vertexCount * 3)
			for (let index = 0; index < vertexCount; index += 1) {
				for (let axis = 0; axis < 3; axis += 1) {
					normals[index * 3 + axis] = Math.max(
						-1,
						(normalValues[index * 4 + axis] ?? 0) / 32_767,
					)
				}
			}
			geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
		}
		const decodedIndices = new Uint8Array(indexCount * indexSize)
		MeshoptDecoder.decodeIndexBuffer(decodedIndices, indexCount, indexSize, encodedIndices)
		geometry.setIndex(
			indexSize === 2
				? new THREE.BufferAttribute(new Uint16Array(decodedIndices.buffer), 1)
				: new THREE.BufferAttribute(new Uint32Array(decodedIndices.buffer), 1),
		)
		if (normalLength === 0) geometry.computeVertexNormals()
		geometry.computeBoundingBox()
		geometry.computeBoundingSphere()
		primitives.push({ geometry, matrix })
	}
	reader.finish()
	return primitives
}

class BinaryReader {
	private readonly view: DataView
	private offset = 0

	constructor(private readonly source: Uint8Array) {
		this.view = new DataView(source.buffer, source.byteOffset, source.byteLength)
	}

	uint8() {
		this.ensure(1)
		return this.view.getUint8(this.offset++)
	}

	uint16() {
		this.ensure(2)
		const value = this.view.getUint16(this.offset, true)
		this.offset += 2
		return value
	}

	uint32() {
		this.ensure(4)
		const value = this.view.getUint32(this.offset, true)
		this.offset += 4
		return value
	}

	float32() {
		this.ensure(4)
		const value = this.view.getFloat32(this.offset, true)
		this.offset += 4
		return value
	}

	count() {
		const value = this.uint32()
		if (value > MAXIMUM_COLLECTION_COUNT) throw new Error('Protected mesh count exceeds limit')
		return value
	}

	count16() {
		const value = this.uint16()
		if (value > 4_096) throw new Error('Protected primitive count exceeds limit')
		return value
	}

	length() {
		const value = this.uint32()
		if (value > this.source.byteLength) throw new Error('Protected mesh length exceeds limit')
		return value
	}

	bytes(length: number) {
		this.ensure(length)
		const value = this.source.subarray(this.offset, this.offset + length)
		this.offset += length
		return value
	}

	matrix() {
		return new THREE.Matrix4().fromArray(Array.from({ length: 16 }, () => this.float32()))
	}

	skip(length: number) {
		this.ensure(length)
		this.offset += length
	}

	finish() {
		if (this.offset !== this.source.byteLength)
			throw new Error('Protected mesh has trailing data')
	}

	private ensure(length: number) {
		if (length < 0 || this.offset + length > this.source.byteLength) {
			throw new Error('Protected mesh bundle is truncated')
		}
	}
}

function requireCommon(common: Map<GhostModelSlot, THREE.BufferGeometry>, slot: GhostModelSlot) {
	const geometry = common.get(slot)
	if (!geometry) throw new Error('Protected mesh bundle is missing common geometry')
	return geometry
}

function disposeLevelBundle(bundle: ProtectedLevelMeshBundle) {
	const geometries = new Set<THREE.BufferGeometry>()
	for (const group of bundle.groups) {
		for (const primitive of group.primitives) geometries.add(primitive.geometry)
	}
	for (const geometry of geometries) geometry.dispose()
}

function disposeGhostModels(ghostModels: GhostSoapboxGeometries) {
	for (const geometry of new Set(Object.values(ghostModels))) geometry.dispose()
}
