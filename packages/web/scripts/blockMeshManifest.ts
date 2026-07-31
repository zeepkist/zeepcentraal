import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as THREE from 'three'

export type BlockMeshMatrix = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
]

export type BlockMeshPart = {
	mesh: string
	matrix: BlockMeshMatrix
	name: string
}

export type BlockMeshDefinition = {
	name: string
	parts: BlockMeshPart[]
}

export type BlockMeshManifest = {
	version: 1
	blocks: Record<string, BlockMeshDefinition>
}

export type BlockMeshConflict = {
	blockId: number
	prefabs: string[]
}

export type BlockMeshUnresolvedReference = {
	blockId: number
	guid: string
	prefab: string
}

export type BlockMeshGenerationReport = {
	blockCount: number
	partCount: number
	meshCount: number
	skippedBadPrefabs: string[]
	skippedBuiltInMeshCount: number
	skippedInactiveRendererCount: number
	conflicts: BlockMeshConflict[]
	unresolvedReferences: BlockMeshUnresolvedReference[]
}

export type GenerateBlockMeshBundleOptions = {
	gameObjectDirectory: string
	assetMeshDirectory: string
	glbMeshDirectory: string
	outputDirectory: string
	copyMeshes?: boolean
}

type UnityGameObject = {
	id: string
	name: string
	active: boolean
}

type UnityTransform = {
	id: string
	gameObjectId: string
	parentId: string | null
	localMatrix: THREE.Matrix4
}

type UnityMeshReference = {
	guid: string | null
	builtIn: boolean
}

type UnityMeshFilter = {
	gameObjectId: string
	mesh: UnityMeshReference
}

type UnityRenderer = {
	gameObjectId: string
	enabled: boolean
}

type UnitySkinnedRenderer = UnityRenderer & {
	mesh: UnityMeshReference
}

type PrefabCandidate = {
	blockId: number
	name: string
	prefab: string
	parts: BlockMeshPart[]
	skippedBuiltInMeshCount: number
	skippedInactiveRendererCount: number
}

type UnityDocument = {
	type: number
	id: string
	body: string
}

const UNITY_DOCUMENT_HEADER_PATTERN = /^--- !u!(\d+) &(-?\d+)\r?$/gm
const UNITY_TO_GLTF = new THREE.Matrix4().makeScale(-1, 1, 1)
const IDENTITY_MATRIX = new THREE.Matrix4()

export async function generateBlockMeshBundle(
	options: GenerateBlockMeshBundleOptions,
): Promise<{ manifest: BlockMeshManifest; report: BlockMeshGenerationReport }> {
	const [prefabNames, assetMetaNames, glbNames] = await Promise.all([
		listFiles(options.gameObjectDirectory, '.prefab'),
		listFiles(options.assetMeshDirectory, '.asset.meta'),
		listFiles(options.glbMeshDirectory, '.glb'),
	])
	const skippedBadPrefabs = prefabNames.filter((name) => /^BAD/i.test(name))
	const parsedCandidates = await mapWithConcurrency(
		prefabNames.filter((prefab) => !/^BAD/i.test(prefab)),
		32,
		async (prefab) => {
			const content = await readFile(join(options.gameObjectDirectory, prefab), 'utf8')
			return parseBlockPrefab(content, prefab)
		},
	)
	const candidates = parsedCandidates.filter(
		(candidate): candidate is PrefabCandidate => candidate !== null,
	)

	const guidToStem = new Map<string, string>()
	const assetMetaEntries = await mapWithConcurrency(assetMetaNames, 32, async (metaName) => {
		const content = await readFile(join(options.assetMeshDirectory, metaName), 'utf8')
		return {
			guid: content.match(/^guid:\s*([a-f0-9]+)\s*$/m)?.[1],
			stem: metaName.slice(0, -'.asset.meta'.length),
		}
	})
	for (const { guid, stem } of assetMetaEntries) {
		if (guid) guidToStem.set(guid, stem)
	}
	const glbStems = new Set(glbNames.map((name) => name.slice(0, -'.glb'.length)))

	const groupedCandidates = Map.groupBy(candidates, ({ blockId }) => blockId)
	const blocks: Record<string, BlockMeshDefinition> = {}
	const conflicts: BlockMeshConflict[] = []
	const unresolvedReferences: BlockMeshUnresolvedReference[] = []
	let skippedBuiltInMeshCount = 0
	let skippedInactiveRendererCount = 0

	for (const [blockId, blockCandidates] of groupedCandidates) {
		for (const candidate of blockCandidates) {
			skippedBuiltInMeshCount += candidate.skippedBuiltInMeshCount
			skippedInactiveRendererCount += candidate.skippedInactiveRendererCount
		}
		const selected = selectCanonicalCandidate(blockId, blockCandidates)
		if (!selected) {
			conflicts.push({
				blockId,
				prefabs: blockCandidates.map(({ prefab }) => prefab).sort(),
			})
			continue
		}
		const parts: BlockMeshPart[] = []
		for (const part of selected.parts) {
			const stem = guidToStem.get(part.mesh)
			if (!stem || !glbStems.has(stem)) {
				unresolvedReferences.push({ blockId, guid: part.mesh, prefab: selected.prefab })
				continue
			}
			parts.push(part)
		}
		blocks[String(blockId)] = { name: selected.name, parts }
	}

	const manifest: BlockMeshManifest = {
		version: 1,
		blocks: Object.fromEntries(
			Object.entries(blocks).sort(([left], [right]) => Number(left) - Number(right)),
		),
	}
	const referencedGuids = new Set(
		Object.values(manifest.blocks).flatMap(({ parts }) => parts.map(({ mesh }) => mesh)),
	)
	const report: BlockMeshGenerationReport = {
		blockCount: Object.keys(manifest.blocks).length,
		partCount: Object.values(manifest.blocks).reduce(
			(total, definition) => total + definition.parts.length,
			0,
		),
		meshCount: referencedGuids.size,
		skippedBadPrefabs: skippedBadPrefabs.sort(),
		skippedBuiltInMeshCount,
		skippedInactiveRendererCount,
		conflicts,
		unresolvedReferences,
	}

	await mkdir(options.outputDirectory, { recursive: true })
	if (options.copyMeshes !== false) {
		const meshOutputDirectory = join(options.outputDirectory, 'meshes')
		await mkdir(meshOutputDirectory, { recursive: true })
		for (const guid of referencedGuids) {
			const stem = guidToStem.get(guid)
			if (!stem || !glbStems.has(stem)) continue
			await copyFile(
				join(options.glbMeshDirectory, `${stem}.glb`),
				join(meshOutputDirectory, `${guid}.glb`),
			)
		}
	}
	await Promise.all([
		writeFile(join(options.outputDirectory, 'manifest.json'), `${JSON.stringify(manifest)}\n`),
		writeFile(
			join(options.outputDirectory, 'report.json'),
			`${JSON.stringify(report, null, 2)}\n`,
		),
	])
	return { manifest, report }
}

export function parseBlockPrefab(content: string, prefab: string): PrefabCandidate | null {
	const documents = parseUnityDocuments(content)
	const gameObjects = new Map<string, UnityGameObject>()
	const transformsById = new Map<string, UnityTransform>()
	const transformsByGameObject = new Map<string, UnityTransform>()
	const meshFilters: UnityMeshFilter[] = []
	const meshRenderers = new Map<string, UnityRenderer[]>()
	const skinnedRenderers: UnitySkinnedRenderer[] = []
	let blockId: number | null = null
	let rootGameObjectId: string | null = null

	for (const document of documents) {
		switch (document.type) {
			case 1: {
				gameObjects.set(document.id, {
					id: document.id,
					name: readScalar(document.body, 'm_Name') ?? '',
					active: readScalar(document.body, 'm_IsActive') !== '0',
				})
				break
			}
			case 4: {
				const gameObjectId = readFileId(document.body, 'm_GameObject')
				if (!gameObjectId) break
				const transform: UnityTransform = {
					id: document.id,
					gameObjectId,
					parentId: nonZeroFileId(readFileId(document.body, 'm_Father')),
					localMatrix: composeUnityTransform(document.body),
				}
				transformsById.set(document.id, transform)
				transformsByGameObject.set(gameObjectId, transform)
				break
			}
			case 23: {
				const gameObjectId = readFileId(document.body, 'm_GameObject')
				if (!gameObjectId) break
				const renderer = {
					gameObjectId,
					enabled: readScalar(document.body, 'm_Enabled') !== '0',
				}
				const renderers = meshRenderers.get(gameObjectId) ?? []
				renderers.push(renderer)
				meshRenderers.set(gameObjectId, renderers)
				break
			}
			case 33: {
				const gameObjectId = readFileId(document.body, 'm_GameObject')
				if (!gameObjectId) break
				meshFilters.push({ gameObjectId, mesh: readMeshReference(document.body) })
				break
			}
			case 114: {
				const parsedBlockId = readScalar(document.body, 'blockID')
				if (parsedBlockId === null) break
				const numericBlockId = Number(parsedBlockId)
				if (!Number.isInteger(numericBlockId)) break
				blockId = numericBlockId
				rootGameObjectId = readFileId(document.body, 'm_GameObject')
				break
			}
			case 137: {
				const gameObjectId = readFileId(document.body, 'm_GameObject')
				if (!gameObjectId) break
				skinnedRenderers.push({
					gameObjectId,
					enabled: readScalar(document.body, 'm_Enabled') !== '0',
					mesh: readMeshReference(document.body),
				})
				break
			}
		}
	}

	if (blockId === null || !rootGameObjectId) return null
	const root = gameObjects.get(rootGameObjectId)
	const rootTransform = transformsByGameObject.get(rootGameObjectId)
	if (!root || !rootTransform) return null
	const parts: BlockMeshPart[] = []
	let skippedBuiltInMeshCount = 0
	let skippedInactiveRendererCount = 0

	const addPart = (gameObjectId: string, mesh: UnityMeshReference, enabled: boolean) => {
		if (mesh.builtIn || !mesh.guid) {
			skippedBuiltInMeshCount += 1
			return
		}
		if (
			!enabled ||
			!isGameObjectActive(
				gameObjectId,
				rootTransform.id,
				gameObjects,
				transformsById,
				transformsByGameObject,
			)
		) {
			skippedInactiveRendererCount += 1
			return
		}
		const unityMatrix = calculateRootRelativeMatrix(
			gameObjectId,
			rootTransform.id,
			transformsById,
			transformsByGameObject,
		)
		if (!unityMatrix) return
		const gltfMatrix = new THREE.Matrix4()
			.multiplyMatrices(UNITY_TO_GLTF, unityMatrix)
			.multiply(UNITY_TO_GLTF)
		parts.push({
			mesh: mesh.guid,
			matrix: gltfMatrix.toArray() as BlockMeshMatrix,
			name: gameObjects.get(gameObjectId)?.name ?? '',
		})
	}

	for (const filter of meshFilters) {
		const enabled =
			meshRenderers.get(filter.gameObjectId)?.some((renderer) => renderer.enabled) === true
		addPart(filter.gameObjectId, filter.mesh, enabled)
	}
	for (const renderer of skinnedRenderers) {
		addPart(renderer.gameObjectId, renderer.mesh, renderer.enabled)
	}
	parts.sort(compareParts)
	return {
		blockId,
		name: root.name || basename(prefab, '.prefab'),
		prefab,
		parts,
		skippedBuiltInMeshCount,
		skippedInactiveRendererCount,
	}
}

function parseUnityDocuments(content: string): UnityDocument[] {
	const headers = [...content.matchAll(UNITY_DOCUMENT_HEADER_PATTERN)]
	return headers.map((match, index) => {
		const bodyStart = (match.index ?? 0) + match[0].length
		const bodyEnd = headers[index + 1]?.index ?? content.length
		return {
			type: Number(match[1]),
			id: match[2] ?? '',
			body: content.slice(bodyStart, bodyEnd),
		}
	})
}

function composeUnityTransform(body: string): THREE.Matrix4 {
	const position = readVector(body, 'm_LocalPosition', { x: 0, y: 0, z: 0 })
	const rotation = readQuaternion(body, 'm_LocalRotation')
	const scale = readVector(body, 'm_LocalScale', { x: 1, y: 1, z: 1 })
	return new THREE.Matrix4().compose(
		new THREE.Vector3(position.x, position.y, position.z),
		new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).normalize(),
		new THREE.Vector3(scale.x, scale.y, scale.z),
	)
}

function calculateRootRelativeMatrix(
	gameObjectId: string,
	rootTransformId: string,
	transformsById: Map<string, UnityTransform>,
	transformsByGameObject: Map<string, UnityTransform>,
): THREE.Matrix4 | null {
	let transform = transformsByGameObject.get(gameObjectId)
	if (!transform) return null
	if (transform.id === rootTransformId) return IDENTITY_MATRIX.clone()
	const chain: THREE.Matrix4[] = []
	const visited = new Set<string>()
	while (transform.id !== rootTransformId) {
		if (visited.has(transform.id)) return null
		visited.add(transform.id)
		chain.push(transform.localMatrix)
		if (!transform.parentId) return null
		const parent = transformsById.get(transform.parentId)
		if (!parent) return null
		transform = parent
	}
	const result = new THREE.Matrix4()
	for (const matrix of chain.reverse()) result.multiply(matrix)
	return result
}

function isGameObjectActive(
	gameObjectId: string,
	rootTransformId: string,
	gameObjects: Map<string, UnityGameObject>,
	transformsById: Map<string, UnityTransform>,
	transformsByGameObject: Map<string, UnityTransform>,
): boolean {
	let transform = transformsByGameObject.get(gameObjectId)
	const visited = new Set<string>()
	while (transform) {
		if (visited.has(transform.id)) return false
		visited.add(transform.id)
		if (gameObjects.get(transform.gameObjectId)?.active === false) return false
		if (transform.id === rootTransformId) return true
		if (!transform.parentId) return false
		transform = transformsById.get(transform.parentId)
	}
	return false
}

function selectCanonicalCandidate(
	blockId: number,
	candidates: PrefabCandidate[],
): PrefabCandidate | null {
	const bySignature = Map.groupBy(candidates, candidateSignature)
	if (bySignature.size === 1) return preferNamedCandidate(blockId, candidates)
	return null
}

function preferNamedCandidate(blockId: number, candidates: PrefabCandidate[]): PrefabCandidate {
	const pattern = new RegExp(`^${blockId}\\s*-\\s*`)
	return (candidates.find(({ name }) => pattern.test(name)) ??
		candidates.find(({ prefab }) => pattern.test(prefab)) ??
		[...candidates].sort((left, right) =>
			left.prefab.localeCompare(right.prefab),
		)[0]) as PrefabCandidate
}

function candidateSignature(candidate: PrefabCandidate): string {
	const geometry = candidate.parts.map(({ mesh, matrix }) => ({ mesh, matrix }))
	geometry.sort(
		(left, right) =>
			left.mesh.localeCompare(right.mesh) ||
			JSON.stringify(left.matrix).localeCompare(JSON.stringify(right.matrix)),
	)
	return JSON.stringify(geometry)
}

function compareParts(left: BlockMeshPart, right: BlockMeshPart): number {
	return (
		left.mesh.localeCompare(right.mesh) ||
		left.name.localeCompare(right.name) ||
		JSON.stringify(left.matrix).localeCompare(JSON.stringify(right.matrix))
	)
}

function readMeshReference(body: string): UnityMeshReference {
	const match = body.match(/^ {2}m_Mesh:\s*\{([^}]+)\}\s*$/m)
	if (!match) return { guid: null, builtIn: true }
	const fields = match[1] ?? ''
	const guid = fields.match(/guid:\s*([a-f0-9]+)/)?.[1] ?? null
	const type = Number(fields.match(/type:\s*(\d+)/)?.[1] ?? 0)
	return {
		guid: guid && !/^0+$/.test(guid) ? guid : null,
		builtIn: type === 0 || !guid || /^0+$/.test(guid),
	}
}

function readScalar(body: string, key: string): string | null {
	const match = body.match(new RegExp(`^  ${escapeRegExp(key)}:\\s*(.*?)\\s*$`, 'm'))
	return match?.[1] ?? null
}

function readFileId(body: string, key: string): string | null {
	const line = readScalar(body, key)
	return line?.match(/fileID:\s*(-?\d+)/)?.[1] ?? null
}

function nonZeroFileId(fileId: string | null): string | null {
	return fileId && fileId !== '0' ? fileId : null
}

function readVector(
	body: string,
	key: string,
	fallback: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
	const value = readScalar(body, key)
	if (!value) return fallback
	return {
		x: readInlineNumber(value, 'x', fallback.x),
		y: readInlineNumber(value, 'y', fallback.y),
		z: readInlineNumber(value, 'z', fallback.z),
	}
}

function readQuaternion(body: string, key: string) {
	const value = readScalar(body, key)
	return {
		x: readInlineNumber(value, 'x', 0),
		y: readInlineNumber(value, 'y', 0),
		z: readInlineNumber(value, 'z', 0),
		w: readInlineNumber(value, 'w', 1),
	}
}

function readInlineNumber(value: string | null, key: string, fallback: number): number {
	const parsed = Number(value?.match(new RegExp(`${key}:\\s*([^,}]+)`))?.[1])
	return Number.isFinite(parsed) ? parsed : fallback
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function listFiles(directory: string, suffix: string): Promise<string[]> {
	return (await readdir(directory)).filter((name) => name.endsWith(suffix)).sort()
}

async function mapWithConcurrency<T, R>(
	values: readonly T[],
	concurrency: number,
	map: (value: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(values.length)
	let nextIndex = 0
	const worker = async () => {
		while (nextIndex < values.length) {
			const index = nextIndex
			nextIndex += 1
			const value = values[index]
			if (value !== undefined) results[index] = await map(value)
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
	return results
}
