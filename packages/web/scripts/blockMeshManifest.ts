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
	attribute?: { index: number; defaultVisible: boolean }
	paint?: { index: number; defaultId?: number }
}

export type BlockMeshDefinition = {
	name: string
	optionMode?: 0 | 1 | 2
	parts: BlockMeshPart[]
}

export type BlockMeshManifest = {
	version: 2
	paints: Record<string, [number, number, number]>
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

export type BlockMeshInvalidController = {
	blockId: number
	prefab: string
	reason: string
}

export type BlockMeshPaintConflict = {
	paintId: number
	assets: string[]
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
	invalidControllers: BlockMeshInvalidController[]
	paintConflicts: BlockMeshPaintConflict[]
}

export type GenerateBlockMeshBundleOptions = {
	gameObjectDirectory: string
	assetMeshDirectory: string
	glbMeshDirectory: string
	paintHolderDirectory: string
	materialDirectory: string
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
	id: string
	gameObjectId: string
	enabled: boolean
	materialGuids: Array<string | null>
}

type UnitySkinnedRenderer = UnityRenderer & {
	mesh: UnityMeshReference
}

type PrefabCandidate = {
	blockId: number
	name: string
	prefab: string
	parts: BlockMeshPart[]
	optionMode?: 0 | 1 | 2
	invalidControllerReasons: string[]
	skippedBuiltInMeshCount: number
	skippedInactiveRendererCount: number
}

type UnityDocument = {
	type: number
	id: string
	body: string
}

type ControlledGameObject = {
	gameObjectId: string
	attributeIndex: number
	defaultVisible: boolean
}

type ParsedOptionController = {
	optionMode?: 0 | 1 | 2
	controlledGameObjects: Map<string, ControlledGameObject>
}

const UNITY_DOCUMENT_HEADER_PATTERN = /^--- !u!(\d+) &(-?\d+)\r?$/gm
const UNITY_TO_GLTF = new THREE.Matrix4().makeScale(-1, 1, 1)
const IDENTITY_MATRIX = new THREE.Matrix4()
const BLOCK_OPTION_CONTROLLER_GUID = 'b4261eb191488cc43931530c16db9ab5'
const ROAD_PAINTER_GUID = '3527f1b5ed7e63940af875bd424d8b18'
const MATERIAL_HOLDER_GUID = '6e47a3d5d8751ec41921d7b6a3037763'

export async function generateBlockMeshBundle(
	options: GenerateBlockMeshBundleOptions,
): Promise<{ manifest: BlockMeshManifest; report: BlockMeshGenerationReport }> {
	const [prefabNames, assetMetaNames, glbNames, paintPalette] = await Promise.all([
		listFiles(options.gameObjectDirectory, '.prefab'),
		listFiles(options.assetMeshDirectory, '.asset.meta'),
		listFiles(options.glbMeshDirectory, '.glb'),
		loadPaintPalette(options.paintHolderDirectory, options.materialDirectory),
	])
	const skippedBadPrefabs = prefabNames.filter((name) => /^BAD/i.test(name))
	const parsedCandidates = await mapWithConcurrency(
		prefabNames.filter((prefab) => !/^BAD/i.test(prefab)),
		32,
		async (prefab) => {
			const content = await readFile(join(options.gameObjectDirectory, prefab), 'utf8')
			return parseBlockPrefab(content, prefab, paintPalette.materialToPaintId)
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
	const invalidControllers: BlockMeshInvalidController[] = []
	let skippedBuiltInMeshCount = 0
	let skippedInactiveRendererCount = 0

	for (const [blockId, blockCandidates] of groupedCandidates) {
		for (const candidate of blockCandidates) {
			skippedBuiltInMeshCount += candidate.skippedBuiltInMeshCount
			skippedInactiveRendererCount += candidate.skippedInactiveRendererCount
			invalidControllers.push(
				...candidate.invalidControllerReasons.map((reason) => ({
					blockId,
					prefab: candidate.prefab,
					reason,
				})),
			)
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
		blocks[String(blockId)] = {
			name: selected.name,
			...(selected.optionMode === undefined ? {} : { optionMode: selected.optionMode }),
			parts,
		}
	}

	const manifest: BlockMeshManifest = {
		version: 2,
		paints: paintPalette.colors,
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
		invalidControllers,
		paintConflicts: paintPalette.conflicts,
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

export function parseBlockPrefab(
	content: string,
	prefab: string,
	materialToPaintId: ReadonlyMap<string, number> = new Map(),
): PrefabCandidate | null {
	const documents = parseUnityDocuments(content)
	const gameObjects = new Map<string, UnityGameObject>()
	const transformsById = new Map<string, UnityTransform>()
	const transformsByGameObject = new Map<string, UnityTransform>()
	const meshFilters: UnityMeshFilter[] = []
	const meshRenderers = new Map<string, UnityRenderer[]>()
	const renderersById = new Map<string, UnityRenderer>()
	const skinnedRenderers: UnitySkinnedRenderer[] = []
	const optionControllerBodies: string[] = []
	const painterBodies: string[] = []
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
					id: document.id,
					gameObjectId,
					enabled: readScalar(document.body, 'm_Enabled') !== '0',
					materialGuids: readGuidList(document.body, 'm_Materials'),
				}
				const renderers = meshRenderers.get(gameObjectId) ?? []
				renderers.push(renderer)
				meshRenderers.set(gameObjectId, renderers)
				renderersById.set(document.id, renderer)
				break
			}
			case 33: {
				const gameObjectId = readFileId(document.body, 'm_GameObject')
				if (!gameObjectId) break
				meshFilters.push({ gameObjectId, mesh: readMeshReference(document.body) })
				break
			}
			case 114: {
				const scriptGuid = readGuidReference(document.body, 'm_Script')
				if (scriptGuid === BLOCK_OPTION_CONTROLLER_GUID) {
					optionControllerBodies.push(document.body)
				}
				if (scriptGuid === ROAD_PAINTER_GUID) painterBodies.push(document.body)
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
					id: document.id,
					gameObjectId,
					enabled: readScalar(document.body, 'm_Enabled') !== '0',
					materialGuids: readGuidList(document.body, 'm_Materials'),
					mesh: readMeshReference(document.body),
				})
				renderersById.set(document.id, skinnedRenderers.at(-1) as UnitySkinnedRenderer)
				break
			}
		}
	}

	if (blockId === null || !rootGameObjectId) return null
	const root = gameObjects.get(rootGameObjectId)
	const rootTransform = transformsByGameObject.get(rootGameObjectId)
	if (!root || !rootTransform) return null
	const invalidControllerReasons: string[] = []
	const controller = parseOptionController(
		optionControllerBodies,
		gameObjects,
		invalidControllerReasons,
	)
	const paintSlots = parsePaintSlots(
		painterBodies,
		renderersById,
		materialToPaintId,
		invalidControllerReasons,
	)
	const parts: BlockMeshPart[] = []
	let skippedBuiltInMeshCount = 0
	let skippedInactiveRendererCount = 0

	const addPart = (
		gameObjectId: string,
		mesh: UnityMeshReference,
		enabled: boolean,
		rendererId: string,
	) => {
		if (mesh.builtIn || !mesh.guid) {
			skippedBuiltInMeshCount += 1
			return
		}
		const controlled = findControlledPart(
			gameObjectId,
			controller.controlledGameObjects,
			rootTransform.id,
			transformsById,
			transformsByGameObject,
		)
		if (
			!enabled ||
			!isGameObjectActiveForPart(
				gameObjectId,
				rootTransform.id,
				controlled?.gameObjectId,
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
		const paint = paintSlots.get(rendererId)
		parts.push({
			mesh: mesh.guid,
			matrix: gltfMatrix.toArray() as BlockMeshMatrix,
			name: gameObjects.get(gameObjectId)?.name ?? '',
			...(controlled
				? {
						attribute: {
							index: controlled.attributeIndex,
							defaultVisible: controlled.defaultVisible,
						},
					}
				: {}),
			...(paint ? { paint } : {}),
		})
	}

	for (const filter of meshFilters) {
		const renderer = meshRenderers
			.get(filter.gameObjectId)
			?.find((candidate) => candidate.enabled)
		addPart(filter.gameObjectId, filter.mesh, Boolean(renderer), renderer?.id ?? '')
	}
	for (const renderer of skinnedRenderers) {
		addPart(renderer.gameObjectId, renderer.mesh, renderer.enabled, renderer.id)
	}
	parts.sort(compareParts)
	return {
		blockId,
		name: root.name || basename(prefab, '.prefab'),
		prefab,
		parts,
		...(controller.optionMode === undefined ? {} : { optionMode: controller.optionMode }),
		invalidControllerReasons,
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

function parseOptionController(
	bodies: string[],
	gameObjects: ReadonlyMap<string, UnityGameObject>,
	invalidReasons: string[],
): ParsedOptionController {
	const controlledGameObjects = new Map<string, ControlledGameObject>()
	const body = bodies[0]
	if (!body) return { controlledGameObjects }
	if (bodies.length > 1) invalidReasons.push('multiple option controllers')
	const blockPieces = readFileIdList(body, 'blockPieces')
	const bridge = readPackedInt32(readScalar(body, 'blockPieceBridgeNR'))
	if (blockPieces.length !== bridge.length) {
		invalidReasons.push(
			`option controller has ${blockPieces.length} pieces but ${bridge.length} bridge values`,
		)
		return { controlledGameObjects }
	}
	const rawMode = Number(readScalar(body, 'blockMode'))
	const optionMode = rawMode === 0 || rawMode === 1 || rawMode === 2 ? rawMode : undefined
	if (optionMode === undefined)
		invalidReasons.push(`unsupported option controller mode ${rawMode}`)
	for (const [index, gameObjectId] of blockPieces.entries()) {
		const gameObject = gameObjects.get(gameObjectId)
		const attributeIndex = bridge[index]
		if (!gameObject) {
			invalidReasons.push(`option controller references missing GameObject ${gameObjectId}`)
			continue
		}
		if (attributeIndex === undefined || attributeIndex < 0 || attributeIndex > 255) {
			invalidReasons.push(`option controller has invalid attribute index ${attributeIndex}`)
			continue
		}
		if (controlledGameObjects.has(gameObjectId)) {
			invalidReasons.push(`option controller repeats GameObject ${gameObjectId}`)
			continue
		}
		controlledGameObjects.set(gameObjectId, {
			gameObjectId,
			attributeIndex,
			defaultVisible: gameObject.active,
		})
	}
	return {
		...(optionMode === undefined ? {} : { optionMode }),
		controlledGameObjects,
	}
}

function parsePaintSlots(
	bodies: string[],
	renderersById: ReadonlyMap<string, UnityRenderer>,
	materialToPaintId: ReadonlyMap<string, number>,
	invalidReasons: string[],
) {
	const slots = new Map<string, { index: number; defaultId?: number }>()
	const body = bodies[0]
	if (!body) return slots
	if (bodies.length > 1) invalidReasons.push('multiple road painter controllers')
	const rendererIds = readFileIdList(body, 'renderers')
	const defaultMaterialIndices = readPackedInt32(
		readScalar(body, 'optionalLeadingPhsxMaterialIndex'),
	)
	for (const [index, rendererId] of rendererIds.entries()) {
		const renderer = renderersById.get(rendererId)
		if (!renderer) {
			invalidReasons.push(`road painter references missing renderer ${rendererId}`)
			continue
		}
		if (slots.has(rendererId)) {
			invalidReasons.push(`road painter repeats renderer ${rendererId}`)
			continue
		}
		const materialIndex = defaultMaterialIndices[index] ?? -1
		const materialGuid = materialIndex >= 0 ? renderer.materialGuids[materialIndex] : undefined
		const defaultId = materialGuid ? materialToPaintId.get(materialGuid) : undefined
		slots.set(rendererId, {
			index,
			...(defaultId === undefined ? {} : { defaultId }),
		})
	}
	return slots
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

function findControlledPart(
	gameObjectId: string,
	controlledGameObjects: ReadonlyMap<string, ControlledGameObject>,
	rootTransformId: string,
	transformsById: ReadonlyMap<string, UnityTransform>,
	transformsByGameObject: ReadonlyMap<string, UnityTransform>,
): ControlledGameObject | null {
	let transform = transformsByGameObject.get(gameObjectId)
	const visited = new Set<string>()
	while (transform) {
		if (visited.has(transform.id)) return null
		visited.add(transform.id)
		const controlled = controlledGameObjects.get(transform.gameObjectId)
		if (controlled) return controlled
		if (transform.id === rootTransformId || !transform.parentId) return null
		transform = transformsById.get(transform.parentId)
	}
	return null
}

function isGameObjectActiveForPart(
	gameObjectId: string,
	rootTransformId: string,
	controlledGameObjectId: string | undefined,
	gameObjects: Map<string, UnityGameObject>,
	transformsById: Map<string, UnityTransform>,
	transformsByGameObject: Map<string, UnityTransform>,
): boolean {
	let transform = transformsByGameObject.get(gameObjectId)
	const visited = new Set<string>()
	while (transform) {
		if (visited.has(transform.id)) return false
		visited.add(transform.id)
		if (
			gameObjects.get(transform.gameObjectId)?.active === false &&
			transform.gameObjectId !== controlledGameObjectId
		) {
			return false
		}
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
	const geometry = candidate.parts.map(({ mesh, matrix, attribute, paint }) => ({
		mesh,
		matrix,
		attribute,
		paintIndex: paint?.index,
	}))
	geometry.sort(
		(left, right) =>
			left.mesh.localeCompare(right.mesh) ||
			JSON.stringify(left.matrix).localeCompare(JSON.stringify(right.matrix)),
	)
	return JSON.stringify({ optionMode: candidate.optionMode, geometry })
}

function compareParts(left: BlockMeshPart, right: BlockMeshPart): number {
	return (
		left.mesh.localeCompare(right.mesh) ||
		left.name.localeCompare(right.name) ||
		JSON.stringify(left.matrix).localeCompare(JSON.stringify(right.matrix)) ||
		JSON.stringify(left.attribute ?? null).localeCompare(
			JSON.stringify(right.attribute ?? null),
		) ||
		(left.paint?.index ?? -1) - (right.paint?.index ?? -1)
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

function readFileIdList(body: string, key: string): string[] {
	const match = body.match(
		new RegExp(`^  ${escapeRegExp(key)}:\\s*\\r?\\n((?:  - .*?(?:\\r?\\n|$))*)`, 'm'),
	)
	return [...(match?.[1] ?? '').matchAll(/fileID:\s*(-?\d+)/g)].map((entry) => entry[1] as string)
}

function readGuidReference(body: string, key: string): string | null {
	return readScalar(body, key)?.match(/guid:\s*([a-f0-9]+)/)?.[1] ?? null
}

function readGuidList(body: string, key: string): Array<string | null> {
	const match = body.match(
		new RegExp(`^  ${escapeRegExp(key)}:\\s*\\r?\\n((?:  - .*?(?:\\r?\\n|$))*)`, 'm'),
	)
	return [...(match?.[1] ?? '').matchAll(/^ {2}- (.*?)$/gm)].map(
		(entry) => entry[1]?.match(/guid:\s*([a-f0-9]+)/)?.[1] ?? null,
	)
}

function readPackedInt32(value: string | null): number[] {
	if (!value || !/^(?:[a-fA-F0-9]{8})+$/.test(value)) return []
	const result: number[] = []
	for (let offset = 0; offset < value.length; offset += 8) {
		const bytes = Uint8Array.from(
			(value.slice(offset, offset + 8).match(/../g) ?? []).map((byte) =>
				Number.parseInt(byte, 16),
			),
		)
		result.push(new DataView(bytes.buffer).getInt32(0, true))
	}
	return result
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

async function loadPaintPalette(paintHolderDirectory: string, materialDirectory: string) {
	const [holderNames, materialMetaNames] = await Promise.all([
		listFiles(paintHolderDirectory, '.asset'),
		listFiles(materialDirectory, '.mat.meta'),
	])
	const materialGuidToName = new Map<string, string>()
	const materialMeta = await mapWithConcurrency(materialMetaNames, 32, async (name) => ({
		name: name.slice(0, -'.meta'.length),
		content: await readFile(join(materialDirectory, name), 'utf8'),
	}))
	for (const { name, content } of materialMeta) {
		const guid = content.match(/^guid:\s*([a-f0-9]+)\s*$/m)?.[1]
		if (guid) materialGuidToName.set(guid, name)
	}
	const parsedHolders = await mapWithConcurrency(holderNames, 32, async (asset) => {
		const body = await readFile(join(paintHolderDirectory, asset), 'utf8')
		if (readGuidReference(body, 'm_Script') !== MATERIAL_HOLDER_GUID) return null
		const rawPaintId = readScalar(body, 'materialID')
		if (rawPaintId === null) return null
		const paintId = Number(rawPaintId)
		if (!Number.isSafeInteger(paintId)) return null
		return {
			asset,
			paintId,
			materialGuid: readGuidReference(body, 'material'),
			splash: readInlineColor(readScalar(body, 'levelEditor_paintSplash')),
			useActual: readScalar(body, 'useActualMaterialInEditorSplash') === '1',
			useMaterialColor: readScalar(body, 'useMaterialColorInstead') === '1',
			useSamplePlusMaterial: readScalar(body, 'useSamplePlusMaterialColor') === '1',
		}
	})
	const holders = parsedHolders.filter(
		(holder): holder is NonNullable<typeof holder> => holder !== null,
	)
	const referencedMaterialGuids = new Set(
		holders.flatMap(({ materialGuid }) => (materialGuid ? [materialGuid] : [])),
	)
	const materialColors = new Map<string, [number, number, number]>()
	await mapWithConcurrency([...referencedMaterialGuids], 32, async (guid) => {
		const name = materialGuidToName.get(guid)
		if (!name) return
		const body = await readFile(join(materialDirectory, name), 'utf8')
		const color = readNamedColor(body, '_Color')
		if (color) materialColors.set(guid, color)
	})
	const colors: Record<string, [number, number, number]> = {}
	const materialToPaintId = new Map<string, number>()
	const conflicts: BlockMeshPaintConflict[] = []
	for (const [paintId, entries] of Map.groupBy(holders, ({ paintId }) => paintId)) {
		const candidates = entries.map((holder) => ({
			asset: holder.asset,
			color: resolvePaintColor(holder, materialColors),
		}))
		if (new Set(candidates.map(({ color }) => JSON.stringify(color))).size > 1) {
			conflicts.push({ paintId, assets: candidates.map(({ asset }) => asset).sort() })
			continue
		}
		const color = candidates[0]?.color
		if (color) colors[String(paintId)] = color
		for (const { materialGuid } of entries) {
			if (materialGuid && !materialToPaintId.has(materialGuid)) {
				materialToPaintId.set(materialGuid, paintId)
			}
		}
	}
	return { colors, materialToPaintId, conflicts }
}

function resolvePaintColor(
	holder: {
		materialGuid: string | null
		splash: [number, number, number]
		useActual: boolean
		useMaterialColor: boolean
		useSamplePlusMaterial: boolean
	},
	materialColors: ReadonlyMap<string, [number, number, number]>,
): [number, number, number] {
	const material = holder.materialGuid ? materialColors.get(holder.materialGuid) : undefined
	if (!material) return holder.splash
	if (holder.useActual || holder.useMaterialColor) return material
	if (holder.useSamplePlusMaterial) {
		return holder.splash.map((value, index) => roundColor(value * (material[index] ?? 1))) as [
			number,
			number,
			number,
		]
	}
	return holder.splash
}

function readNamedColor(body: string, name: string): [number, number, number] | null {
	const match = body.match(new RegExp(`^    - ${escapeRegExp(name)}:\\s*(\\{.*?\\})\\s*$`, 'm'))
	return match?.[1] ? readInlineColor(match[1]) : null
}

function readInlineColor(value: string | null): [number, number, number] {
	return [
		roundColor(readInlineNumber(value, 'r', 0.65)),
		roundColor(readInlineNumber(value, 'g', 0.63)),
		roundColor(readInlineNumber(value, 'b', 0.6)),
	]
}

function roundColor(value: number) {
	return Math.round(Math.min(1, Math.max(0, value)) * 1_000_000) / 1_000_000
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
