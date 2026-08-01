import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MeshoptEncoder } from 'meshoptimizer/encoder'
import { MeshoptSimplifier } from 'meshoptimizer/simplifier'
import * as THREE from 'three'
import { GHOST_SOAPBOX_AXLE_POSITIONS } from '../app/utils/ghostSoapbox'
import {
	PROTECTED_MESH_CORPUS_VERSION,
	PROTECTED_MESH_PRIMITIVE_MAGIC,
	PROTECTED_MESH_PRIMITIVE_VERSION,
	type ProtectedMeshCorpusIndex,
	type ProtectedMeshMatrix,
} from '../shared/protectedMeshFormat'
import type { BlockMeshManifest } from './blockMeshManifest'

type Primitive = {
	matrix: ProtectedMeshMatrix
	positions: Float32Array
	normals: Float32Array | null
	indices: Uint32Array
}

type EncodedPrimitive = {
	matrix: ProtectedMeshMatrix
	vertexCount: number
	indexCount: number
	indexSize: 2 | 4
	minimum: [number, number, number]
	maximum: [number, number, number]
	positions: Uint8Array
	normals: Uint8Array
	indices: Uint8Array
	error: number
	originalIndexCount: number
}

type GlbJson = {
	accessors?: Array<{
		bufferView?: number
		byteOffset?: number
		componentType: number
		count: number
		type: string
		normalized?: boolean
	}>
	bufferViews?: Array<{
		buffer: number
		byteOffset?: number
		byteLength: number
		byteStride?: number
	}>
	meshes?: Array<{
		primitives: Array<{ attributes: Record<string, number>; indices?: number; mode?: number }>
	}>
	nodes?: Array<{
		children?: number[]
		matrix?: number[]
		mesh?: number
		rotation?: number[]
		scale?: number[]
		translation?: number[]
	}>
	scenes?: Array<{ nodes?: number[] }>
	scene?: number
}

export type CompileProtectedBlockMeshCorpusOptions = {
	bundleDirectory: string
	ghostModelDirectory: string
	outputDirectory: string
}

export type ProtectedBlockMeshCorpusReport = {
	blockCount: number
	meshCount: number
	primitiveCount: number
	commonPrimitiveCount: number
	originalTriangleCount: number
	triangleCount: number
	maximumSimplificationError: number
	encodedBytes: number
}

const IDENTITY_MATRIX = new THREE.Matrix4()
const MODEL_ROTATION_X = -Math.PI / 2
const SPOILER_OFFSET_Y = -1.0146778822
const SIMPLIFY_TRIANGLE_THRESHOLD = 1_000
const SIMPLIFY_RATIO = 0.6
const SIMPLIFY_ERROR = 0.001

export async function compileProtectedBlockMeshCorpus(
	options: CompileProtectedBlockMeshCorpusOptions,
): Promise<ProtectedBlockMeshCorpusReport> {
	await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready])
	const manifest = JSON.parse(
		await readFile(join(options.bundleDirectory, 'manifest.json'), 'utf8'),
	) as BlockMeshManifest
	if (manifest.version !== 2 || !manifest.blocks || !manifest.paints) {
		throw new Error('Block mesh bundle version 2 required; regenerate from raw exports')
	}
	const outputMeshDirectory = join(options.outputDirectory, 'meshes')
	await mkdir(outputMeshDirectory, { recursive: true })

	const sourceMeshes = new Set(
		Object.values(manifest.blocks).flatMap(({ parts }) => parts.map(({ mesh }) => mesh)),
	)
	const sourceToOpaque = new Map<string, string>()
	const fileDigests: string[] = []
	let primitiveCount = 0
	let commonPrimitiveCount = 0
	let originalTriangleCount = 0
	let triangleCount = 0
	let maximumSimplificationError = 0
	let encodedBytes = 0

	for (const source of [...sourceMeshes].sort()) {
		const opaque = opaqueName(source)
		const primitives = parseGlb(
			await readFile(join(options.bundleDirectory, 'meshes', `${source}.glb`)),
		)
		const encoded = encodePrimitiveFile(primitives)
		const fileName = `${opaque}.zcp`
		await writeFile(join(outputMeshDirectory, fileName), encoded.bytes)
		sourceToOpaque.set(source, fileName)
		fileDigests.push(hashBytes(encoded.bytes))
		primitiveCount += primitives.length
		originalTriangleCount += encoded.originalIndexCount / 3
		triangleCount += encoded.indexCount / 3
		maximumSimplificationError = Math.max(maximumSimplificationError, encoded.maximumError)
		encodedBytes += encoded.bytes.byteLength
	}

	const common = await loadCommonGhostModels(options.ghostModelDirectory)
	const commonFiles = {} as ProtectedMeshCorpusIndex['common']
	for (const [name, primitive] of Object.entries(common)) {
		const encoded = encodePrimitiveFile([primitive])
		const fileName = `common-${name}.zcp`
		await writeFile(join(outputMeshDirectory, fileName), encoded.bytes)
		commonFiles[name as keyof typeof commonFiles] = fileName
		fileDigests.push(hashBytes(encoded.bytes))
		commonPrimitiveCount += 1
		originalTriangleCount += encoded.originalIndexCount / 3
		triangleCount += encoded.indexCount / 3
		maximumSimplificationError = Math.max(maximumSimplificationError, encoded.maximumError)
		encodedBytes += encoded.bytes.byteLength
	}

	const blocks: ProtectedMeshCorpusIndex['blocks'] = {}
	for (const [blockId, definition] of Object.entries(manifest.blocks)) {
		blocks[blockId] = {
			...(definition.optionMode === undefined ? {} : { optionMode: definition.optionMode }),
			parts: definition.parts.flatMap(({ mesh, matrix, attribute, paint }) => {
				const protectedMesh = sourceToOpaque.get(mesh)
				return protectedMesh
					? [
							{
								mesh: protectedMesh,
								matrix,
								...(attribute ? { attribute } : {}),
								...(paint ? { paint } : {}),
							},
						]
					: []
			}),
		}
	}
	const unsignedIndex = {
		version: PROTECTED_MESH_CORPUS_VERSION,
		blocks,
		paints: manifest.paints,
		common: commonFiles,
	}
	const digest = createHash('sha256')
		.update(JSON.stringify(unsignedIndex))
		.update(fileDigests.join(''))
		.digest('hex')
	const index: ProtectedMeshCorpusIndex = { ...unsignedIndex, digest }
	const report: ProtectedBlockMeshCorpusReport = {
		blockCount: Object.keys(blocks).length,
		meshCount: sourceMeshes.size,
		primitiveCount,
		commonPrimitiveCount,
		originalTriangleCount,
		triangleCount,
		maximumSimplificationError,
		encodedBytes,
	}
	await Promise.all([
		writeFile(join(options.outputDirectory, 'index.json'), `${JSON.stringify(index)}\n`),
		writeFile(
			join(options.outputDirectory, 'report.json'),
			`${JSON.stringify(report, null, 2)}\n`,
		),
	])
	return report
}

function encodePrimitiveFile(primitives: Primitive[]) {
	const encoded = primitives.map(encodePrimitive)
	const headerSize = 8
	const primitiveHeaderSize = 16 * 4 + 5 * 4 + 4 + 6 * 4
	const byteLength =
		headerSize +
		encoded.reduce(
			(total, primitive) =>
				total +
				primitiveHeaderSize +
				primitive.positions.byteLength +
				primitive.normals.byteLength +
				primitive.indices.byteLength,
			0,
		)
	const bytes = new Uint8Array(byteLength)
	const view = new DataView(bytes.buffer)
	let offset = 0
	view.setUint32(offset, PROTECTED_MESH_PRIMITIVE_MAGIC, true)
	offset += 4
	view.setUint16(offset, PROTECTED_MESH_PRIMITIVE_VERSION, true)
	offset += 2
	view.setUint16(offset, encoded.length, true)
	offset += 2
	for (const primitive of encoded) {
		for (const value of primitive.matrix) {
			view.setFloat32(offset, value, true)
			offset += 4
		}
		for (const value of [
			primitive.vertexCount,
			primitive.indexCount,
			primitive.positions.byteLength,
			primitive.normals.byteLength,
			primitive.indices.byteLength,
		]) {
			view.setUint32(offset, value, true)
			offset += 4
		}
		view.setUint8(offset, primitive.indexSize)
		offset += 4
		for (const value of [...primitive.minimum, ...primitive.maximum]) {
			view.setFloat32(offset, value, true)
			offset += 4
		}
		for (const payload of [primitive.positions, primitive.normals, primitive.indices]) {
			bytes.set(payload, offset)
			offset += payload.byteLength
		}
	}
	return {
		bytes,
		indexCount: encoded.reduce((total, primitive) => total + primitive.indexCount, 0),
		originalIndexCount: encoded.reduce(
			(total, primitive) => total + primitive.originalIndexCount,
			0,
		),
		maximumError: Math.max(0, ...encoded.map(({ error }) => error)),
	}
}

function encodePrimitive(primitive: Primitive): EncodedPrimitive {
	let indices = primitive.indices
	let error = 0
	const originalIndexCount = indices.length
	if (indices.length / 3 > SIMPLIFY_TRIANGLE_THRESHOLD) {
		const target = Math.max(3, Math.floor((indices.length * SIMPLIFY_RATIO) / 3) * 3)
		const simplified = MeshoptSimplifier.simplify(
			indices,
			primitive.positions,
			3,
			target,
			SIMPLIFY_ERROR,
			['LockBorder'],
		)
		indices = simplified[0]
		error = simplified[1]
	}
	const { minimum, maximum } = positionBounds(primitive.positions)
	const quantizedPositions = new Uint16Array((primitive.positions.length / 3) * 4)
	for (let index = 0; index < primitive.positions.length / 3; index += 1) {
		for (let axis = 0; axis < 3; axis += 1) {
			const range = maximum[axis] - minimum[axis]
			const value = primitive.positions[index * 3 + axis] ?? 0
			quantizedPositions[index * 4 + axis] =
				range === 0 ? 0 : Math.round(((value - minimum[axis]) / range) * 65_535)
		}
	}
	const positions = MeshoptEncoder.encodeVertexBuffer(
		new Uint8Array(quantizedPositions.buffer),
		primitive.positions.length / 3,
		8,
	)
	let normals = new Uint8Array()
	if (primitive.normals) {
		const padded = new Float32Array((primitive.normals.length / 3) * 4)
		for (let index = 0; index < primitive.normals.length / 3; index += 1) {
			padded[index * 4] = primitive.normals[index * 3] ?? 0
			padded[index * 4 + 1] = primitive.normals[index * 3 + 1] ?? 0
			padded[index * 4 + 2] = primitive.normals[index * 3 + 2] ?? 0
			padded[index * 4 + 3] = 1
		}
		const octahedral = MeshoptEncoder.encodeFilterOct(padded, padded.length / 4, 8, 16)
		normals = MeshoptEncoder.encodeVertexBuffer(octahedral, padded.length / 4, 8)
	}
	const maximumIndex = indices.reduce((maximumValue, value) => Math.max(maximumValue, value), 0)
	const indexSize = maximumIndex <= 65_535 ? 2 : 4
	const typedIndices = indexSize === 2 ? new Uint16Array(indices) : indices
	const encodedIndices = MeshoptEncoder.encodeIndexBuffer(
		new Uint8Array(typedIndices.buffer, typedIndices.byteOffset, typedIndices.byteLength),
		indices.length,
		indexSize,
	)
	return {
		matrix: primitive.matrix,
		vertexCount: primitive.positions.length / 3,
		indexCount: indices.length,
		indexSize,
		minimum,
		maximum,
		positions,
		normals,
		indices: encodedIndices,
		error,
		originalIndexCount,
	}
}

function parseGlb(bytes: Uint8Array): Primitive[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
		throw new Error('Unsupported GLB')
	}
	let offset = 12
	let json: GlbJson | null = null
	let binary = new Uint8Array()
	while (offset + 8 <= bytes.byteLength) {
		const length = view.getUint32(offset, true)
		const type = view.getUint32(offset + 4, true)
		const payload = bytes.subarray(offset + 8, offset + 8 + length)
		if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(payload)) as GlbJson
		if (type === 0x004e4942) binary = payload
		offset += 8 + length
	}
	if (!json) throw new Error('GLB JSON chunk missing')
	const result: Primitive[] = []
	const scene = json.scenes?.[json.scene ?? 0]
	for (const root of scene?.nodes ?? []) visitGlbNode(json, binary, root, IDENTITY_MATRIX, result)
	if (result.length === 0) throw new Error('GLB contains no triangle primitives')
	return result
}

function visitGlbNode(
	json: GlbJson,
	binary: Uint8Array,
	nodeIndex: number,
	parentMatrix: THREE.Matrix4,
	result: Primitive[],
) {
	const node = json.nodes?.[nodeIndex]
	if (!node) return
	const matrix = parentMatrix.clone().multiply(readNodeMatrix(node))
	const mesh = node.mesh === undefined ? undefined : json.meshes?.[node.mesh]
	for (const primitive of mesh?.primitives ?? []) {
		if ((primitive.mode ?? 4) !== 4) continue
		const positionAccessor = primitive.attributes.POSITION
		if (positionAccessor === undefined) continue
		const positions = readAccessor(json, binary, positionAccessor)
		const normalAccessor = primitive.attributes.NORMAL
		const normals =
			normalAccessor === undefined ? null : readAccessor(json, binary, normalAccessor)
		const indices =
			primitive.indices === undefined
				? Uint32Array.from({ length: positions.length / 3 }, (_, index) => index)
				: Uint32Array.from(readAccessor(json, binary, primitive.indices))
		result.push({
			matrix: matrix.toArray() as ProtectedMeshMatrix,
			positions,
			normals,
			indices,
		})
	}
	for (const child of node.children ?? []) visitGlbNode(json, binary, child, matrix, result)
}

function readNodeMatrix(node: NonNullable<GlbJson['nodes']>[number]) {
	if (node.matrix?.length === 16) return new THREE.Matrix4().fromArray(node.matrix)
	return new THREE.Matrix4().compose(
		new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
		new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
		new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
	)
}

function readAccessor(json: GlbJson, binary: Uint8Array, accessorIndex: number) {
	const accessor = json.accessors?.[accessorIndex]
	if (!accessor || accessor.bufferView === undefined) throw new Error('Unsupported GLB accessor')
	const bufferView = json.bufferViews?.[accessor.bufferView]
	if (bufferView?.buffer !== 0) throw new Error('Unsupported GLB buffer view')
	const components = accessorComponents(accessor.type)
	const componentSize = accessorComponentSize(accessor.componentType)
	const stride = bufferView.byteStride ?? components * componentSize
	const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
	const source = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
	const values = new Float32Array(accessor.count * components)
	for (let index = 0; index < accessor.count; index += 1) {
		for (let component = 0; component < components; component += 1) {
			values[index * components + component] = readAccessorComponent(
				source,
				start + index * stride + component * componentSize,
				accessor.componentType,
				Boolean(accessor.normalized),
			)
		}
	}
	return values
}

function accessorComponents(type: string) {
	const count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type]
	if (!count) throw new Error(`Unsupported GLB accessor type: ${type}`)
	return count
}

function accessorComponentSize(type: number) {
	if (type === 5120 || type === 5121) return 1
	if (type === 5122 || type === 5123) return 2
	if (type === 5125 || type === 5126) return 4
	throw new Error(`Unsupported GLB component type: ${type}`)
}

function readAccessorComponent(view: DataView, offset: number, type: number, normalized: boolean) {
	const value =
		type === 5120
			? view.getInt8(offset)
			: type === 5121
				? view.getUint8(offset)
				: type === 5122
					? view.getInt16(offset, true)
					: type === 5123
						? view.getUint16(offset, true)
						: type === 5125
							? view.getUint32(offset, true)
							: view.getFloat32(offset, true)
	if (!normalized || type === 5125 || type === 5126) return value
	if (type === 5120) return Math.max(-1, value / 127)
	if (type === 5121) return value / 255
	if (type === 5122) return Math.max(-1, value / 32_767)
	return value / 65_535
}

async function loadCommonGhostModels(directory: string): Promise<Record<string, Primitive>> {
	const [axle, character, soapbox, spoiler, wheel] = await Promise.all(
		['axle', 'character', 'soapbox', 'spoiler', 'wheel'].map(async (name) =>
			transformStl(parseStl(await readFile(join(directory, `${name}.stl`)))),
		),
	)
	centerPrimitive(axle)
	centerPrimitive(wheel)
	translatePrimitive(spoiler, 0, SPOILER_OFFSET_Y, 0)
	const axles = mergePrimitives(
		GHOST_SOAPBOX_AXLE_POSITIONS.map((position) => {
			const copy = clonePrimitive(axle)
			translatePrimitive(copy, ...position)
			return copy
		}),
	)
	return { axles, body: mergePrimitives([soapbox, spoiler]), character, wheel }
}

function parseStl(bytes: Uint8Array): Primitive {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const triangleCount = bytes.byteLength >= 84 ? view.getUint32(80, true) : 0
	if (84 + triangleCount * 50 === bytes.byteLength) {
		const positions = new Float32Array(triangleCount * 9)
		const normals = new Float32Array(triangleCount * 9)
		let offset = 84
		for (let triangle = 0; triangle < triangleCount; triangle += 1) {
			const normal = [
				view.getFloat32(offset, true),
				view.getFloat32(offset + 4, true),
				view.getFloat32(offset + 8, true),
			]
			offset += 12
			for (let vertex = 0; vertex < 3; vertex += 1) {
				for (let axis = 0; axis < 3; axis += 1) {
					positions[triangle * 9 + vertex * 3 + axis] = view.getFloat32(offset, true)
					normals[triangle * 9 + vertex * 3 + axis] = normal[axis] ?? 0
					offset += 4
				}
			}
			offset += 2
		}
		return primitiveFromTriangles(positions, normals)
	}
	const text = new TextDecoder().decode(bytes)
	const values = [...text.matchAll(/vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/gi)].flatMap(
		([, x, y, z]) => [Number(x), Number(y), Number(z)],
	)
	if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
		throw new Error('Unsupported STL')
	}
	return primitiveFromTriangles(new Float32Array(values), null)
}

function primitiveFromTriangles(positions: Float32Array, normals: Float32Array | null): Primitive {
	return {
		matrix: IDENTITY_MATRIX.toArray() as ProtectedMeshMatrix,
		positions,
		normals,
		indices: Uint32Array.from({ length: positions.length / 3 }, (_, index) => index),
	}
}

function transformStl(primitive: Primitive) {
	const matrix = new THREE.Matrix4().makeRotationX(MODEL_ROTATION_X)
	applyMatrix(primitive, matrix)
	return primitive
}

function applyMatrix(primitive: Primitive, matrix: THREE.Matrix4) {
	const position = new THREE.Vector3()
	for (let index = 0; index < primitive.positions.length; index += 3) {
		position.fromArray(primitive.positions, index).applyMatrix4(matrix)
		position.toArray(primitive.positions, index)
	}
	if (!primitive.normals) return
	const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
	for (let index = 0; index < primitive.normals.length; index += 3) {
		position.fromArray(primitive.normals, index).applyMatrix3(normalMatrix).normalize()
		position.toArray(primitive.normals, index)
	}
}

function centerPrimitive(primitive: Primitive) {
	const { minimum, maximum } = positionBounds(primitive.positions)
	translatePrimitive(
		primitive,
		-(minimum[0] + maximum[0]) / 2,
		-(minimum[1] + maximum[1]) / 2,
		-(minimum[2] + maximum[2]) / 2,
	)
}

function translatePrimitive(primitive: Primitive, x: number, y: number, z: number) {
	for (let index = 0; index < primitive.positions.length; index += 3) {
		primitive.positions[index] = (primitive.positions[index] ?? 0) + x
		primitive.positions[index + 1] = (primitive.positions[index + 1] ?? 0) + y
		primitive.positions[index + 2] = (primitive.positions[index + 2] ?? 0) + z
	}
}

function mergePrimitives(primitives: Primitive[]): Primitive {
	const positionCount = primitives.reduce(
		(total, primitive) => total + primitive.positions.length,
		0,
	)
	const indexCount = primitives.reduce((total, primitive) => total + primitive.indices.length, 0)
	const positions = new Float32Array(positionCount)
	const hasNormals = primitives.every(({ normals }) => normals !== null)
	const normals = hasNormals ? new Float32Array(positionCount) : null
	const indices = new Uint32Array(indexCount)
	let positionOffset = 0
	let indexOffset = 0
	for (const primitive of primitives) {
		positions.set(primitive.positions, positionOffset)
		if (normals && primitive.normals) normals.set(primitive.normals, positionOffset)
		const vertexOffset = positionOffset / 3
		for (const [index, value] of primitive.indices.entries()) {
			indices[indexOffset + index] = value + vertexOffset
		}
		positionOffset += primitive.positions.length
		indexOffset += primitive.indices.length
	}
	return { matrix: IDENTITY_MATRIX.toArray() as ProtectedMeshMatrix, positions, normals, indices }
}

function clonePrimitive(primitive: Primitive): Primitive {
	return {
		matrix: [...primitive.matrix],
		positions: primitive.positions.slice(),
		normals: primitive.normals?.slice() ?? null,
		indices: primitive.indices.slice(),
	}
}

function positionBounds(positions: Float32Array) {
	const minimum: [number, number, number] = [
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		Number.POSITIVE_INFINITY,
	]
	const maximum: [number, number, number] = [
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	]
	for (let index = 0; index < positions.length; index += 3) {
		for (let axis = 0; axis < 3; axis += 1) {
			const value = positions[index + axis] ?? 0
			minimum[axis] = Math.min(minimum[axis], value)
			maximum[axis] = Math.max(maximum[axis], value)
		}
	}
	return { minimum, maximum }
}

function opaqueName(source: string) {
	return createHash('sha256').update(`zeepcentraal-mesh-v1:${source}`).digest('hex').slice(0, 32)
}

function hashBytes(bytes: Uint8Array) {
	return createHash('sha256').update(bytes).digest('hex')
}
