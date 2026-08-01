import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as THREE from 'three'
import type { GhostLevelBlock, GhostVector3 } from '../../app/types/ghost'
import {
	GHOST_MODEL_SLOTS,
	PROTECTED_MESH_BUNDLE_MAGIC,
	PROTECTED_MESH_BUNDLE_VERSION,
	PROTECTED_MESH_CORPUS_VERSION,
	type ProtectedMeshCorpusIndex,
	type ProtectedMeshMatrix,
} from '../../shared/protectedMeshFormat'

type Corpus = {
	index: ProtectedMeshCorpusIndex
	directory: string
	files: Map<string, Promise<Uint8Array>>
}

type BundleGroup = { payload: Uint8Array; matrices: ProtectedMeshMatrix[] }

const corpusPromises = new Map<string, Promise<Corpus>>()
const ghostModelBundlePromises = new Map<string, Promise<Uint8Array>>()
const ASSET_RIPPER_TO_GHOST_MATRIX = new THREE.Matrix4().makeRotationY(Math.PI)
const ZERO_VECTOR = { x: 0, y: 0, z: 0 }
const MAXIMUM_BUNDLE_BYTES = 64 * 1024 * 1024

export async function buildProtectedLevelMeshBundle(
	corpusDirectory: string,
	blocks: readonly GhostLevelBlock[],
) {
	const corpus = await loadCorpus(corpusDirectory)
	const groups = new Map<string, ProtectedMeshMatrix[]>()
	const fallbackMatrices: ProtectedMeshMatrix[] = []
	for (const block of blocks) {
		const definition = block.id === null ? undefined : corpus.index.blocks[String(block.id)]
		if (!definition || definition.parts.length === 0) {
			fallbackMatrices.push(matrixArray(createFallbackMatrix(block, ZERO_VECTOR)))
			continue
		}
		const blockMatrix = createBlockMatrix(block, ZERO_VECTOR).multiply(
			ASSET_RIPPER_TO_GHOST_MATRIX,
		)
		for (const part of definition.parts) {
			const matrices = groups.get(part.mesh) ?? []
			matrices.push(
				matrixArray(
					blockMatrix.clone().multiply(new THREE.Matrix4().fromArray(part.matrix)),
				),
			)
			groups.set(part.mesh, matrices)
		}
	}
	const bundleGroups: BundleGroup[] = await Promise.all(
		[...groups.entries()].map(async ([file, matrices]) => ({
			payload: await readCorpusFile(corpus, file),
			matrices,
		})),
	)
	return serializeBundle(corpus.index.digest, bundleGroups, fallbackMatrices, [])
}

export function buildProtectedGhostModelBundle(corpusDirectory: string) {
	let promise = ghostModelBundlePromises.get(corpusDirectory)
	if (!promise) {
		promise = loadCorpus(corpusDirectory).then(async (corpus) => {
			const common = await Promise.all(
				(
					Object.entries(corpus.index.common) as Array<
						[keyof ProtectedMeshCorpusIndex['common'], string]
					>
				).map(async ([name, file]) => ({
					slot: GHOST_MODEL_SLOTS[name],
					payload: await readCorpusFile(corpus, file),
				})),
			)
			return serializeBundle(corpus.index.digest, [], [], common)
		})
		ghostModelBundlePromises.set(corpusDirectory, promise)
	}
	return promise
}

export function protectedMeshBundleCacheKey(digest: string, blocks: readonly GhostLevelBlock[]) {
	return createHash('sha256').update(digest).update(JSON.stringify(blocks)).digest('hex')
}

export async function protectedMeshCorpusDigest(corpusDirectory: string) {
	return (await loadCorpus(corpusDirectory)).index.digest
}

async function loadCorpus(directory: string) {
	if (!directory)
		throw createError({ statusCode: 503, statusMessage: 'Protected mesh corpus missing' })
	let promise = corpusPromises.get(directory)
	if (!promise) {
		promise = readFile(join(directory, 'index.json'), 'utf8').then((value) => {
			const index = JSON.parse(value) as ProtectedMeshCorpusIndex
			if (
				index.version !== PROTECTED_MESH_CORPUS_VERSION ||
				!index.digest ||
				!index.blocks ||
				!index.common
			) {
				throw new Error('Protected mesh corpus index has unsupported shape')
			}
			return { index, directory, files: new Map() }
		})
		corpusPromises.set(directory, promise)
	}
	try {
		return await promise
	} catch {
		corpusPromises.delete(directory)
		throw createError({ statusCode: 503, statusMessage: 'Protected mesh corpus unavailable' })
	}
}

function readCorpusFile(corpus: Corpus, file: string) {
	if (!/^(?:[a-f0-9]{32}|common-(?:axles|body|character|wheel))\.zcp$/.test(file)) {
		throw new Error('Protected mesh corpus contains unsafe filename')
	}
	let promise = corpus.files.get(file)
	if (!promise) {
		promise = readFile(join(corpus.directory, 'meshes', file)).then(
			(value) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
		)
		corpus.files.set(file, promise)
	}
	return promise
}

function serializeBundle(
	digest: string,
	groups: BundleGroup[],
	fallbackMatrices: ProtectedMeshMatrix[],
	common: Array<{ slot: number; payload: Uint8Array }>,
) {
	const headerSize = 52
	const byteLength =
		headerSize +
		groups.reduce(
			(total, group) => total + 8 + group.payload.byteLength + group.matrices.length * 64,
			0,
		) +
		fallbackMatrices.length * 64 +
		common.reduce((total, entry) => total + 8 + entry.payload.byteLength, 0)
	if (byteLength > MAXIMUM_BUNDLE_BYTES) {
		throw createError({ statusCode: 413, statusMessage: 'Protected mesh bundle too large' })
	}
	const bytes = new Uint8Array(byteLength)
	const view = new DataView(bytes.buffer)
	let offset = 0
	view.setUint32(offset, PROTECTED_MESH_BUNDLE_MAGIC, true)
	offset += 4
	view.setUint16(offset, PROTECTED_MESH_BUNDLE_VERSION, true)
	offset += 2
	view.setUint16(offset, 0, true)
	offset += 2
	bytes.set(Buffer.from(digest, 'hex').subarray(0, 32), offset)
	offset += 32
	for (const count of [groups.length, fallbackMatrices.length, common.length]) {
		view.setUint32(offset, count, true)
		offset += 4
	}
	for (const group of groups) {
		view.setUint32(offset, group.payload.byteLength, true)
		view.setUint32(offset + 4, group.matrices.length, true)
		offset += 8
		bytes.set(group.payload, offset)
		offset += group.payload.byteLength
		for (const matrix of group.matrices) offset = writeMatrix(view, offset, matrix)
	}
	for (const matrix of fallbackMatrices) offset = writeMatrix(view, offset, matrix)
	for (const entry of common) {
		view.setUint8(offset, entry.slot)
		view.setUint32(offset + 4, entry.payload.byteLength, true)
		offset += 8
		bytes.set(entry.payload, offset)
		offset += entry.payload.byteLength
	}
	return bytes
}

function writeMatrix(view: DataView, offset: number, matrix: ProtectedMeshMatrix) {
	let cursor = offset
	for (const value of matrix) {
		view.setFloat32(cursor, value, true)
		cursor += 4
	}
	return cursor
}

function createBlockMatrix(block: GhostLevelBlock, origin: GhostVector3) {
	return createTransformMatrix(block, origin, clampMeshScale)
}

function createFallbackMatrix(block: GhostLevelBlock, origin: GhostVector3) {
	return createTransformMatrix(block, origin, clampFallbackScale)
}

function createTransformMatrix(
	block: GhostLevelBlock,
	origin: GhostVector3,
	mapScale: (value: number) => number,
) {
	const position = {
		x: block.position.x - origin.x,
		y: block.position.y - origin.y,
		z: -(block.position.z - origin.z),
	}
	const euler = new THREE.Euler(
		THREE.MathUtils.degToRad(-block.rotation.x),
		THREE.MathUtils.degToRad(-block.rotation.y),
		THREE.MathUtils.degToRad(block.rotation.z),
		'YXZ',
	)
	return new THREE.Matrix4().compose(
		new THREE.Vector3(position.x, position.y, position.z),
		new THREE.Quaternion().setFromEuler(euler),
		new THREE.Vector3(
			mapScale(block.scale.x),
			mapScale(block.scale.y),
			mapScale(block.scale.z),
		),
	)
}

function clampMeshScale(value: number) {
	const sign = value < 0 ? -1 : 1
	return sign * Math.min(64, Math.max(0.001, Math.abs(value)))
}

function clampFallbackScale(value: number) {
	return Math.min(64, Math.max(0.2, Math.abs(value) * 2))
}

function matrixArray(matrix: THREE.Matrix4) {
	return matrix.toArray() as ProtectedMeshMatrix
}

export function clearProtectedMeshCorpusCaches() {
	corpusPromises.clear()
	ghostModelBundlePromises.clear()
}
