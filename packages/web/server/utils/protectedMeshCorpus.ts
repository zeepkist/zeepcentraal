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
	PROTECTED_MESH_GROUP_FLAGS,
	type ProtectedMeshColor,
	type ProtectedMeshCorpusIndex,
	type ProtectedMeshMatrix,
} from '../../shared/protectedMeshFormat'

type Corpus = {
	index: ProtectedMeshCorpusIndex
	source: CorpusSource
}

type CorpusSource =
	| { kind: 'local'; directory: string }
	| { kind: 'remote'; baseUrl: URL; referer: string }

type BundleGroup = {
	payload: Uint8Array
	matrices: ProtectedMeshMatrix[]
	color: ProtectedMeshColor | null
	reflectX: boolean
}

const corpusPromises = new Map<string, Promise<Corpus>>()
// Binary bundles stay here only while builds are active; getPendingBundle removes settled entries.
const pendingLevelBundlePromises = new Map<string, Promise<Uint8Array>>()
const pendingGhostModelBundlePromises = new Map<string, Promise<Uint8Array>>()
const ASSET_RIPPER_TO_GHOST_MATRIX = new THREE.Matrix4().makeRotationY(Math.PI)
const REFLECT_X_MATRIX = new THREE.Matrix4().makeScale(-1, 1, 1)
const ZERO_VECTOR = { x: 0, y: 0, z: 0 }
const MAXIMUM_BUNDLE_BYTES = 64 * 1024 * 1024
const MAXIMUM_CORPUS_INDEX_BYTES = 16 * 1024 * 1024
const BLOCK_CORPUS_REFERER_PREFIX = 'https://zeepki.st/server/block-corpus/'
const MATRIX_DETERMINANT_EPSILON = 1e-12
const BLOCK_POSITION_JITTER_MAGNITUDE = 0.01
const blockPositionJitterMatrices = new Map<string, THREE.Matrix4>()

export async function buildProtectedLevelMeshBundle(
	corpusLocation: string,
	blocks: readonly GhostLevelBlock[],
	corpusToken = '',
) {
	const corpus = await loadCorpus(corpusLocation, corpusToken)
	const bundleKey = [
		corpusSourceCacheKey(corpusLocation, corpusToken),
		protectedMeshBundleCacheKey(corpus.index.digest, blocks),
	].join(':')
	return getPendingBundle(pendingLevelBundlePromises, bundleKey, () =>
		buildProtectedLevelMeshBundleUncached(corpus, blocks),
	)
}

async function buildProtectedLevelMeshBundleUncached(
	corpus: Corpus,
	blocks: readonly GhostLevelBlock[],
) {
	const groups = new Map<
		string,
		{
			file: string
			color: ProtectedMeshColor | null
			reflectX: boolean
			matrices: ProtectedMeshMatrix[]
		}
	>()
	const fallbackMatrices: ProtectedMeshMatrix[] = []
	for (const block of blocks) {
		const definition = block.id === null ? undefined : corpus.index.blocks[String(block.id)]
		if (!definition) {
			fallbackMatrices.push(matrixArray(createFallbackMatrix(block, ZERO_VECTOR)))
			continue
		}
		const blockMatrix = createBlockMatrix(block, ZERO_VECTOR).multiply(
			ASSET_RIPPER_TO_GHOST_MATRIX,
		)
		for (const part of selectProtectedMeshParts(definition, block.attributes)) {
			const paintId = part.paint
				? (block.paints[part.paint.index] ?? part.paint.defaultId)
				: undefined
			const color =
				paintId === undefined ? null : (corpus.index.paints[String(paintId)] ?? null)
			const matrix = blockMatrix.clone().multiply(new THREE.Matrix4().fromArray(part.matrix))
			const determinant = matrix.determinant()
			if (
				!Number.isFinite(determinant) ||
				Math.abs(determinant) <= MATRIX_DETERMINANT_EPSILON
			) {
				continue
			}
			const reflectX = determinant < 0
			if (reflectX) matrix.multiply(REFLECT_X_MATRIX)
			const colorKey = protectedMeshColorKey(color)
			matrix.premultiply(blockPositionJitterMatrix(colorKey))
			const key = `${part.mesh}:${colorKey}:${reflectX ? 1 : 0}`
			const group = groups.get(key) ?? {
				file: part.mesh,
				color,
				reflectX,
				matrices: [],
			}
			group.matrices.push(matrixArray(matrix))
			groups.set(key, group)
		}
	}
	const files = new Map<string, Promise<Uint8Array>>()
	const bundleGroups: BundleGroup[] = await Promise.all(
		[...groups.values()].map(async ({ file, color, reflectX, matrices }) => ({
			payload: await readCorpusFile(corpus, files, file),
			color,
			reflectX,
			matrices,
		})),
	)
	return serializeBundle(corpus.index.digest, bundleGroups, fallbackMatrices, [])
}

export function selectProtectedMeshParts(
	definition: ProtectedMeshCorpusIndex['blocks'][string],
	attributes: Readonly<Record<number, number>>,
) {
	const activeAttributes = resolveActiveAttributes(definition, attributes)
	return definition.parts.filter((part) => isPartVisible(part.attribute, activeAttributes))
}

function resolveActiveAttributes(
	definition: ProtectedMeshCorpusIndex['blocks'][string],
	attributes: Readonly<Record<number, number>>,
): Set<number> | null {
	if (Object.keys(attributes).length === 0) return null
	const controlled = new Set(
		definition.parts.flatMap(({ attribute }) => (attribute ? [attribute.index] : [])),
	)
	const requested = new Set(
		Object.entries(attributes)
			.filter(([index, value]) => value === 1 && controlled.has(Number(index)))
			.map(([index]) => Number(index)),
	)
	const defaults = new Set(
		definition.parts.flatMap(({ attribute }) =>
			attribute?.defaultVisible ? [attribute.index] : [],
		),
	)
	if (definition.optionMode === 0) return requested.size > 0 ? requested : defaults
	if (definition.optionMode === 1) return requested
	if (definition.optionMode === 2) {
		const selected = [...(requested.size > 0 ? requested : defaults)].sort((a, b) => a - b)[0]
		return new Set(selected === undefined ? [] : [selected])
	}
	return requested
}

function isPartVisible(
	attribute: { index: number; defaultVisible: boolean } | undefined,
	activeAttributes: ReadonlySet<number> | null,
) {
	if (!attribute) return true
	return activeAttributes === null
		? attribute.defaultVisible
		: activeAttributes.has(attribute.index)
}

export async function buildProtectedGhostModelBundle(corpusLocation: string, corpusToken = '') {
	const bundleKey = corpusSourceCacheKey(corpusLocation, corpusToken)
	const corpus = await loadCorpus(corpusLocation, corpusToken)
	return getPendingBundle(pendingGhostModelBundlePromises, bundleKey, async () => {
		const files = new Map<string, Promise<Uint8Array>>()
		const common = await Promise.all(
			(
				Object.entries(corpus.index.common) as Array<
					[keyof ProtectedMeshCorpusIndex['common'], string]
				>
			).map(async ([name, file]) => ({
				slot: GHOST_MODEL_SLOTS[name],
				payload: await readCorpusFile(corpus, files, file),
			})),
		)
		return serializeBundle(corpus.index.digest, [], [], common)
	})
}

export function protectedMeshBundleCacheKey(digest: string, blocks: readonly GhostLevelBlock[]) {
	return createHash('sha256').update(digest).update(JSON.stringify(blocks)).digest('hex')
}

export async function protectedMeshCorpusDigest(corpusLocation: string, corpusToken = '') {
	return (await loadCorpus(corpusLocation, corpusToken)).index.digest
}

async function loadCorpus(location: string, token: string) {
	if (!location)
		throw createError({ statusCode: 503, statusMessage: 'Protected mesh corpus missing' })
	const cacheKey = corpusSourceCacheKey(location, token)
	let promise = corpusPromises.get(cacheKey)
	if (!promise) {
		promise = createCorpusSource(location, token).then(async (source) => {
			const value = await readCorpusIndex(source)
			const index = JSON.parse(value) as ProtectedMeshCorpusIndex
			if (
				index.version !== PROTECTED_MESH_CORPUS_VERSION ||
				!index.digest ||
				!index.blocks ||
				!index.paints ||
				!index.common
			) {
				throw new Error('Protected mesh corpus index has unsupported shape')
			}
			return { index, source }
		})
		corpusPromises.set(cacheKey, promise)
	}
	try {
		return await promise
	} catch {
		corpusPromises.delete(cacheKey)
		throw createError({ statusCode: 503, statusMessage: 'Protected mesh corpus unavailable' })
	}
}

async function createCorpusSource(location: string, token: string): Promise<CorpusSource> {
	if (/^https:\/\//i.test(location)) {
		if (!token) throw new Error('Remote protected mesh corpus token missing')
		const baseUrl = new URL(location.endsWith('/') ? location : `${location}/`)
		return {
			kind: 'remote',
			baseUrl,
			referer: `${BLOCK_CORPUS_REFERER_PREFIX}${encodeURIComponent(token)}`,
		}
	}
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(location)) {
		throw new Error('Remote protected mesh corpus must use HTTPS')
	}
	return { kind: 'local', directory: location }
}

function corpusSourceCacheKey(location: string, token: string) {
	return createHash('sha256').update(location).update('\0').update(token).digest('hex')
}

async function readCorpusIndex(source: CorpusSource) {
	if (source.kind === 'local') return readFile(join(source.directory, 'index.json'), 'utf8')
	const bytes = await fetchCorpusBytes(
		new URL('index.json', source.baseUrl),
		source.referer,
		MAXIMUM_CORPUS_INDEX_BYTES,
	)
	return new TextDecoder().decode(bytes)
}

function readCorpusFile(corpus: Corpus, files: Map<string, Promise<Uint8Array>>, file: string) {
	if (!/^(?:[a-f0-9]{32}|common-(?:axles|body|character|wheel))\.zcp$/.test(file)) {
		throw new Error('Protected mesh corpus contains unsafe filename')
	}
	let promise = files.get(file)
	if (!promise) {
		promise = readCorpusBytes(corpus.source, file)
		files.set(file, promise)
	}
	return promise
}

function getPendingBundle(
	pending: Map<string, Promise<Uint8Array>>,
	key: string,
	build: () => Promise<Uint8Array>,
) {
	const existing = pending.get(key)
	if (existing) return existing
	const promise = build()
	pending.set(key, promise)
	const remove = () => {
		if (pending.get(key) === promise) pending.delete(key)
	}
	promise.then(remove, remove)
	return promise
}

async function readCorpusBytes(source: CorpusSource, file: string) {
	if (source.kind === 'local') {
		const value = await readFile(join(source.directory, 'meshes', file))
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
	}
	return fetchCorpusBytes(
		new URL(`meshes/${file}`, source.baseUrl),
		source.referer,
		MAXIMUM_BUNDLE_BYTES,
	)
}

async function fetchCorpusBytes(url: URL, referer: string, maximumBytes: number) {
	const response = await fetch(url, {
		cache: 'no-store',
		headers: { referer },
		redirect: 'error',
	})
	if (!response.ok) throw new Error(`Protected mesh corpus returned ${response.status}`)
	const contentLength = Number(response.headers.get('content-length'))
	if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
		throw new Error('Protected mesh corpus response too large')
	}
	const bytes = new Uint8Array(await response.arrayBuffer())
	if (bytes.byteLength > maximumBytes) {
		throw new Error('Protected mesh corpus response too large')
	}
	return bytes
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
			(total, group) => total + 12 + group.payload.byteLength + group.matrices.length * 64,
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
		if (group.color) {
			for (const [index, value] of group.color.entries()) {
				view.setUint8(offset + 8 + index, Math.round(Math.min(1, Math.max(0, value)) * 255))
			}
		}
		const flags =
			(group.color ? PROTECTED_MESH_GROUP_FLAGS.hasColor : 0) |
			(group.reflectX ? PROTECTED_MESH_GROUP_FLAGS.reflectX : 0)
		view.setUint8(offset + 11, flags)
		offset += 12
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

function protectedMeshColorKey(color: ProtectedMeshColor | null) {
	return color
		? color.map((value) => Math.round(Math.min(1, Math.max(0, value)) * 255)).join(',')
		: 'neutral'
}

function blockPositionJitterMatrix(colorKey: string) {
	let matrix = blockPositionJitterMatrices.get(colorKey)
	if (!matrix) {
		const digest = createHash('sha256')
			.update(`protected-mesh-position-jitter:${colorKey}`)
			.digest()
		const offset = new THREE.Vector3(
			digest.readUInt16LE(0) / 32_767.5 - 1,
			digest.readUInt16LE(2) / 32_767.5 - 1,
			digest.readUInt16LE(4) / 32_767.5 - 1,
		)
		if (offset.lengthSq() <= Number.EPSILON) offset.set(1, 0, 0)
		offset.normalize().multiplyScalar(BLOCK_POSITION_JITTER_MAGNITUDE)
		matrix = new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z)
		blockPositionJitterMatrices.set(colorKey, matrix)
	}
	return matrix
}

export function clearProtectedMeshCorpusCaches() {
	corpusPromises.clear()
	pendingLevelBundlePromises.clear()
	pendingGhostModelBundlePromises.clear()
}
