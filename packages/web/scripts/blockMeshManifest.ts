import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import * as THREE from 'three'
import type { GhostEnvironment, ProtectedLightDefinition } from '../shared/ghostLighting'
import type {
	ProtectedMeshMaterial,
	ProtectedMeshMaterialSlot,
	ProtectedMeshVisibility,
} from '../shared/protectedMeshFormat'
import { extractUnityLights, loadUnitySkyProfiles } from './unityLighting'
import { loadUnityMaterials } from './unityMaterials'

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
	visibility?: ProtectedMeshVisibility[]
	variant?: { index: number; count: number }
	paint?: { index: number; defaultId?: number }
	materials: ProtectedMeshMaterialSlot[]
}

export type BlockMeshDefinition = {
	name: string
	optionMode?: 0 | 1 | 2
	parts: BlockMeshPart[]
	lights?: ProtectedLightDefinition[]
}

export type BlockMeshManifest = {
	version: 4 | 5
	skyProfiles?: Record<string, GhostEnvironment>
	paints: Record<string, [number, number, number]>
	materials: Record<string, ProtectedMeshMaterial>
	paintMaterials: Record<string, string>
	submeshCounts: Record<string, number>
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

export type BlockMeshPaintPhysicsError = {
	paintId: number
	asset: string
	physicsGuid: string | null
	reason: 'missing-reference' | 'unresolved-reference' | 'unsupported-surface'
}

export type BlockMeshGenerationReport = {
	blockCount: number
	partCount: number
	meshCount: number
	optionControllerCount: number
	variantControllerCount: number
	paintCount: number
	materialCount: number
	materialDefaults: Array<{ material: string; properties: string[] }>
	skippedBadPrefabs: string[]
	skippedBuiltInMeshCount: number
	skippedInactiveRendererCount: number
	conflicts: BlockMeshConflict[]
	unresolvedReferences: BlockMeshUnresolvedReference[]
	invalidControllers: BlockMeshInvalidController[]
	paintConflicts: BlockMeshPaintConflict[]
	paintPhysicsErrors: BlockMeshPaintPhysicsError[]
}

export type GenerateBlockMeshBundleOptions = {
	gameObjectDirectory: string
	assetMeshDirectory: string
	glbMeshDirectory: string
	paintHolderDirectory: string
	outputDirectory: string
	scriptDirectory?: string
	materialDirectory?: string
	shaderDirectory?: string
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
	id: string
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
	lights?: ProtectedLightDefinition[]
	optionMode?: 0 | 1 | 2
	optionControllerCount: number
	variantControllerCount: number
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
}

type ParsedOptionController = {
	optionMode?: 0 | 1 | 2
	controlledGameObjects: Map<string, ControlledGameObject>
}

const UNITY_DOCUMENT_HEADER_PATTERN = /^--- !u!(\d+) &(-?\d+)\r?$/gm
const UNITY_TO_GLTF = new THREE.Matrix4().makeScale(-1, 1, 1)
const IDENTITY_MATRIX = new THREE.Matrix4()
const PHYSICS_SURFACE_COLORS: Readonly<Record<string, [number, number, number]>> = {
	Tarmac: srgb('#8B929A'),
	'Ice 0.05': srgb('#D9F4FF'),
	'Ice 0.10': srgb('#A9DDF5'),
	'Ice 0.15': srgb('#69B7E8'),
	Sand: srgb('#E8C77B'),
	Mud: srgb('#B9825A'),
	Grass: srgb('#8FCB7B'),
	Wood: srgb('#C99562'),
	Soap: srgb('#EAA3BC'),
}

export async function generateBlockMeshBundle(
	options: GenerateBlockMeshBundleOptions,
): Promise<{ manifest: BlockMeshManifest; report: BlockMeshGenerationReport }> {
	const scriptNames = await loadUnityScriptCatalog(
		options.scriptDirectory ??
			join(dirname(options.gameObjectDirectory), 'Scripts', 'Zeepkist'),
	)
	const [prefabNames, assetMetaNames, glbNames, paintPalette, nativePalette] = await Promise.all([
		listFiles(options.gameObjectDirectory, '.prefab'),
		listFiles(options.assetMeshDirectory, '.asset.meta'),
		listFiles(options.glbMeshDirectory, '.glb'),
		loadPaintPalette(options.paintHolderDirectory, scriptNames),
		loadUnityMaterials(
			options.materialDirectory ?? join(dirname(options.gameObjectDirectory), 'Material'),
			options.shaderDirectory ?? join(dirname(options.gameObjectDirectory), 'Shader'),
		),
	])
	const skippedBadPrefabs = prefabNames.filter((name) => /^BAD/i.test(name))
	const parsedCandidates = await mapWithConcurrency(
		prefabNames.filter((prefab) => !/^BAD/i.test(prefab)),
		32,
		async (prefab) => {
			const content = await readFile(join(options.gameObjectDirectory, prefab), 'utf8')
			return parseBlockPrefab(content, prefab, paintPalette.materialToPaintId, scriptNames)
		},
	)
	const candidates = parsedCandidates.filter(
		(candidate): candidate is PrefabCandidate => candidate !== null,
	)

	const guidToStem = new Map<string, string>()
	const submeshCounts: Record<string, number> = {}
	const assetMetaEntries = await mapWithConcurrency(assetMetaNames, 32, async (metaName) => {
		const content = await readFile(join(options.assetMeshDirectory, metaName), 'utf8')
		const asset = await readFile(
			join(options.assetMeshDirectory, metaName.slice(0, -5)),
			'utf8',
		)
		const count =
			asset
				.match(/m_SubMeshes:([\s\S]*?)\n {2}m_Shapes:/)?.[1]
				?.match(/- serializedVersion:/g)?.length ?? 0
		if (!count) throw new Error(`Malformed submesh table: ${metaName}`)
		return {
			guid: content.match(/^guid:\s*([a-f0-9]+)\s*$/m)?.[1],
			count,
			stem: metaName.slice(0, -'.asset.meta'.length),
		}
	})
	for (const { guid, stem, count } of assetMetaEntries) {
		if (guid) {
			guidToStem.set(guid, stem)
			submeshCounts[guid] = count
		}
	}
	const glbStems = new Set(glbNames.map((name) => name.slice(0, -'.glb'.length)))

	const groupedCandidates = Map.groupBy(candidates, ({ blockId }) => blockId)
	const blocks: Record<string, BlockMeshDefinition> = {}
	const conflicts: BlockMeshConflict[] = []
	const unresolvedReferences: BlockMeshUnresolvedReference[] = []
	const invalidControllers: BlockMeshInvalidController[] = []
	let skippedBuiltInMeshCount = 0
	let skippedInactiveRendererCount = 0
	let optionControllerCount = 0
	let variantControllerCount = 0

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
		optionControllerCount += selected.optionControllerCount
		variantControllerCount += selected.variantControllerCount
		const parts: BlockMeshPart[] = []
		for (const part of selected.parts) {
			const stem = guidToStem.get(part.mesh)
			if (!stem || !glbStems.has(stem)) {
				unresolvedReferences.push({ blockId, guid: part.mesh, prefab: selected.prefab })
				continue
			}
			for (const slot of part.materials) {
				if (slot.material && !nativePalette.materials[slot.material])
					throw new Error(
						`Unresolved renderer material: ${slot.material} (${nativePalette.unresolved[slot.material] ?? selected.prefab})`,
					)
			}
			parts.push(part)
		}
		blocks[String(blockId)] = {
			name: selected.name,
			...(selected.optionMode === undefined ? {} : { optionMode: selected.optionMode }),
			parts,
			...(selected.lights?.length ? { lights: selected.lights } : {}),
		}
	}

	for (const [paintId, guid] of Object.entries(paintPalette.paintMaterials)) {
		if (!nativePalette.materials[guid])
			throw new Error(
				`Unresolved paint material: ${paintId}, ${guid} (${nativePalette.unresolved[guid] ?? 'missing .mat.meta'})`,
			)
	}
	const manifest: BlockMeshManifest = {
		version: 5,
		skyProfiles: await loadUnitySkyProfiles(options.gameObjectDirectory, scriptNames),
		paints: paintPalette.colors,
		materials: nativePalette.materials,
		paintMaterials: paintPalette.paintMaterials,
		submeshCounts,
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
		optionControllerCount,
		variantControllerCount,
		paintCount: Object.keys(paintPalette.colors).length,
		materialCount: Object.keys(nativePalette.materials).length,
		materialDefaults: nativePalette.defaults,
		skippedBadPrefabs: skippedBadPrefabs.sort(),
		skippedBuiltInMeshCount,
		skippedInactiveRendererCount,
		conflicts,
		unresolvedReferences,
		invalidControllers,
		paintConflicts: paintPalette.conflicts,
		paintPhysicsErrors: paintPalette.physicsErrors,
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
	scriptNames: ReadonlyMap<string, string> = new Map(),
): PrefabCandidate | null {
	const documents = parseUnityDocuments(content)
	const gameObjects = new Map<string, UnityGameObject>()
	const transformsById = new Map<string, UnityTransform>()
	const transformsByGameObject = new Map<string, UnityTransform>()
	const meshFilters: UnityMeshFilter[] = []
	const meshRenderers = new Map<string, UnityRenderer[]>()
	const renderersById = new Map<string, UnityRenderer>()
	const skinnedRenderers: UnitySkinnedRenderer[] = []
	const behaviours = new Map<string, UnityDocument>()
	let blockPropertiesBody = ''
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
				meshFilters.push({
					id: document.id,
					gameObjectId,
					mesh: readMeshReference(document.body),
				})
				break
			}
			case 114: {
				behaviours.set(document.id, document)
				const parsedBlockId = readScalar(document.body, 'blockID')
				if (parsedBlockId === null) break
				const numericBlockId = Number(parsedBlockId)
				if (!Number.isInteger(numericBlockId)) break
				blockId = numericBlockId
				rootGameObjectId = readFileId(document.body, 'm_GameObject')
				blockPropertiesBody = document.body
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
	const gameplay = parsePrefabGameplay(
		blockPropertiesBody,
		behaviours,
		scriptNames,
		gameObjects,
		transformsByGameObject,
		transformsById,
		rootTransform.id,
		meshFilters,
		renderersById,
		invalidControllerReasons,
	)
	const paintSlots = parsePaintSlots(
		gameplay.painterBodies,
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
		variant?: { index: number; count: number },
	) => {
		if (mesh.builtIn || !mesh.guid) {
			skippedBuiltInMeshCount += 1
			return
		}
		const state = gameplay.visibility(gameObjectId)
		if (!enabled || gameplay.hiddenRenderers.has(rendererId) || !state.visible) {
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
		const paintSlot = paintSlots.get(rendererId)
		const paint = paintSlot
			? {
					index: paintSlot.index,
					...(paintSlot.defaultId === undefined
						? {}
						: { defaultId: paintSlot.defaultId }),
				}
			: undefined
		const materials = (renderersById.get(rendererId)?.materialGuids ?? []).map(
			(material, index) => ({
				material,
				...(paintSlot ? { paintIndex: paintSlot.offset + index } : {}),
			}),
		)
		parts.push({
			mesh: mesh.guid,
			matrix: gltfMatrix.toArray() as BlockMeshMatrix,
			materials,
			name: gameObjects.get(gameObjectId)?.name ?? '',
			...(state.conditions.length > 0 ? { visibility: state.conditions } : {}),
			...(variant ? { variant } : {}),
			...(paint ? { paint } : {}),
		})
	}

	for (const filter of meshFilters) {
		const renderer = meshRenderers
			.get(filter.gameObjectId)
			?.find((candidate) => candidate.enabled)
		const variants = gameplay.variants.get(filter.id)
		if (variants) {
			for (const [index, mesh] of variants.entries()) {
				addPart(filter.gameObjectId, mesh, Boolean(renderer), renderer?.id ?? '', {
					index,
					count: variants.length,
				})
			}
		} else {
			addPart(filter.gameObjectId, filter.mesh, Boolean(renderer), renderer?.id ?? '')
		}
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
		lights: extractUnityLights(
			documents,
			scriptNames,
			(gameObjectId) =>
				calculateRootRelativeMatrix(
					gameObjectId,
					rootTransform.id,
					transformsById,
					transformsByGameObject,
				),
			gameplay.visibility,
		),
		...(gameplay.optionMode === undefined ? {} : { optionMode: gameplay.optionMode }),
		optionControllerCount: gameplay.optionControllerCount,
		variantControllerCount: gameplay.variants.size,
		invalidControllerReasons,
		skippedBuiltInMeshCount,
		skippedInactiveRendererCount,
	}
}

type VisibilityState = { visible: boolean; conditions: ProtectedMeshVisibility[] }

function parsePrefabGameplay(
	blockBody: string,
	behaviours: ReadonlyMap<string, UnityDocument>,
	scriptNames: ReadonlyMap<string, string>,
	gameObjects: ReadonlyMap<string, UnityGameObject>,
	transformsByGameObject: ReadonlyMap<string, UnityTransform>,
	transformsById: ReadonlyMap<string, UnityTransform>,
	rootTransformId: string,
	meshFilters: UnityMeshFilter[],
	renderers: ReadonlyMap<string, UnityRenderer>,
	invalidReasons: string[],
) {
	const states = new Map<string, VisibilityState>(
		[...gameObjects].map(([id, object]) => [id, { visible: object.active, conditions: [] }]),
	)
	const hiddenRenderers = new Set<string>()
	const variants = new Map<string, UnityMeshReference[]>()
	const followerSources = new Map<string, string>()
	const painterBodies: string[] = []
	let optionMode: 0 | 1 | 2 | undefined
	let optionControllerCount = 0
	const scriptName = (body: string) => scriptNames.get(readGuidReference(body, 'm_Script') ?? '')
	if (scriptName(blockBody) !== 'BlockProperties') {
		invalidReasons.push('BlockProperties script metadata unresolved')
	}
	const setState = (id: string | null, state: VisibilityState, source: string) => {
		if (!id || id === '0' || !gameObjects.has(id)) {
			invalidReasons.push(`${source} references missing GameObject ${id}`)
			return
		}
		states.set(id, state)
	}
	const setList = (body: string, key: string, visible: boolean, source: string) => {
		for (const id of readFileIdList(body, key))
			setState(id, { visible, conditions: [] }, source)
	}
	for (const id of readFileIdList(blockBody, 'propertyScripts')) {
		const document = behaviours.get(id)
		if (!document) {
			invalidReasons.push(`propertyScripts references missing component ${id}`)
			continue
		}
		const body = document.body
		const name = scriptName(body)
		if (!name) {
			invalidReasons.push(`propertyScripts script metadata unresolved for component ${id}`)
			continue
		}
		if (name === 'BlockEdit_RoadABCD_NEW' || name === 'BlockEdit_v18_RoadABCD') {
			const controller = parseOptionController([body], gameObjects, invalidReasons)
			optionControllerCount += 1
			optionMode = controller.optionMode
			for (const [objectId, controlled] of controller.controlledGameObjects) {
				setState(
					objectId,
					{
						visible: true,
						conditions: [{ kind: 'attribute', index: controlled.attributeIndex }],
					},
					name,
				)
			}
		} else if (name === 'Properties_RoadPainter') {
			painterBodies.push(body)
		} else if (name === 'BlockEdit_DisableGameObjects' || name === 'InvisibleBlockScript') {
			setList(body, 'editorObjects', false, name)
			setList(
				body,
				name === 'InvisibleBlockScript' ? 'gamesObjects' : 'playerObjects',
				true,
				name,
			)
			if (name === 'InvisibleBlockScript') {
				for (const rendererId of readFileIdList(body, 'hideThese')) {
					if (!renderers.has(rendererId))
						invalidReasons.push(`hideThese references missing renderer ${rendererId}`)
					hiddenRenderers.add(rendererId)
				}
			}
		} else if (name === 'PlaceDynamicObject') {
			setState(readFileId(body, 'editorObject'), { visible: false, conditions: [] }, name)
			setList(body, 'auxEditorObjects', false, name)
			// Render each gameplay template once, at its saved transform, before physics moves its clone.
			setState(readFileId(body, 'levelObject'), { visible: true, conditions: [] }, name)
			setList(body, 'auxLevelObjects', true, name)
		} else if (name === 'BlockEdit_v18_DiscoRoadABCD') {
			const filterId = readFileId(body, 'meshFilter') ?? ''
			const meshes = readGuidList(body, 'availableMeshes').map((guid) => ({
				guid,
				builtIn: !guid,
			}))
			if (
				!meshFilters.some((filter) => filter.id === filterId) ||
				meshes.length === 0 ||
				meshes.some((mesh) => !mesh.guid)
			) {
				invalidReasons.push(`${name} has missing mesh filter or invalid availableMeshes`)
			} else if (variants.has(filterId)) {
				invalidReasons.push(`${name} repeats mesh filter ${filterId}`)
			} else {
				variants.set(filterId, meshes)
			}
		} else if (name === 'BlockEdit_v18_C_Logic_Trigger') {
			setState(
				readFileId(body, 'triggerGlow'),
				{
					visible: true,
					conditions: [{ kind: 'hideTrigger' }],
				},
				name,
			)
		} else if (name.startsWith('BlockEdit_v18_C_Logic_')) {
			for (const objectId of readFileIdList(body, 'chipGameObjects')) {
				setState(
					objectId,
					{
						visible: true,
						conditions: [{ kind: 'hideLogicBlock' }],
					},
					name,
				)
			}
		}
	}
	for (const { body } of behaviours.values()) {
		if (
			scriptName(body) !== 'EnableDisableOtherGameObjects' ||
			readScalar(body, 'm_Enabled') === '0'
		)
			continue
		const sourceId = readFileId(body, 'm_GameObject') ?? ''
		if (!gameObjects.has(sourceId)) {
			invalidReasons.push(`follower source GameObject ${sourceId} missing`)
			continue
		}
		for (const targetId of readFileIdList(body, 'followers')) {
			if (!gameObjects.has(targetId))
				invalidReasons.push(`follower GameObject ${targetId} missing`)
			if (followerSources.has(targetId) && followerSources.get(targetId) !== sourceId) {
				invalidReasons.push(`follower GameObject ${targetId} has multiple sources`)
			}
			followerSources.set(targetId, sourceId)
		}
	}
	const cache = new Map<string, VisibilityState>()
	const visibility = (id: string, visited = new Set<string>()): VisibilityState => {
		const cached = cache.get(id)
		if (cached) return cached
		if (visited.has(id)) {
			invalidReasons.push(`cyclic gameplay visibility at GameObject ${id}`)
			return { visible: false, conditions: [] }
		}
		const transform = transformsByGameObject.get(id)
		if (!transform) {
			invalidReasons.push(`GameObject ${id} has no transform`)
			return { visible: false, conditions: [] }
		}
		const path = new Set(visited).add(id)
		const sourceId = followerSources.get(id)
		const own = sourceId ? visibility(sourceId, path) : states.get(id)
		if (!own) return { visible: false, conditions: [] }
		let parent: VisibilityState = { visible: true, conditions: [] }
		if (transform.id !== rootTransformId) {
			const parentTransform = transform.parentId
				? transformsById.get(transform.parentId)
				: undefined
			if (!parentTransform) {
				invalidReasons.push(`GameObject ${id} has no parent inside block`)
				return { visible: false, conditions: [] }
			}
			parent = visibility(parentTransform.gameObjectId, path)
		}
		const conditions = [
			...new Map(
				[...own.conditions, ...parent.conditions].map((condition) => [
					JSON.stringify(condition),
					condition,
				]),
			).values(),
		].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
		const result = { visible: own.visible && parent.visible, conditions }
		cache.set(id, result)
		return result
	}
	return {
		visibility,
		hiddenRenderers,
		variants,
		painterBodies,
		optionMode,
		optionControllerCount,
	}
}

export async function loadUnityScriptCatalog(directory: string): Promise<Map<string, string>> {
	const entries = await mapWithConcurrency(
		await listFiles(directory, '.cs.meta'),
		32,
		async (name) => {
			const content = await readFile(join(directory, name), 'utf8')
			const guid = content.match(/^guid:\s*([a-f0-9]{32})\s*$/m)?.[1]
			if (!guid) throw new Error(`Unity script metadata missing GUID: ${name}`)
			return { guid, name: name.slice(0, -'.cs.meta'.length) }
		},
	)
	const result = new Map<string, string>()
	for (const { guid, name } of entries) {
		if (result.has(guid)) throw new Error(`Unity script metadata repeats GUID: ${name}`)
		result.set(guid, name)
	}
	for (const name of ['BlockProperties', 'Properties_RoadPainter', 'MaterialHolder']) {
		if (!entries.some((entry) => entry.name === name))
			throw new Error(`Unity script metadata missing ${name}`)
	}
	return result
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
	const bridge = readPackedInt32(
		readScalar(body, 'blockPieceBridgeNR') ?? readScalar(body, 'blockPieceNR'),
	)
	if (blockPieces.length !== bridge.length) {
		invalidReasons.push(
			`option controller has ${blockPieces.length} pieces but ${bridge.length} bridge values`,
		)
		return { controlledGameObjects }
	}
	const rawMode = Number(readScalar(body, 'blockMode') ?? Number.NaN)
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
	const slots = new Map<string, { index: number; offset: number; defaultId?: number }>()
	const body = bodies[0]
	if (!body) return slots
	if (bodies.length > 1) invalidReasons.push('multiple road painter controllers')
	const rendererIds = readFileIdList(body, 'renderers')
	const defaultMaterialIndices = readPackedInt32(
		readScalar(body, 'optionalLeadingPhsxMaterialIndex'),
	)
	let paintIndex = 0
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
		const materialIndex = Math.max(0, defaultMaterialIndices[index] ?? 0)
		const materialGuid = renderer.materialGuids[materialIndex]
		const defaultId = materialGuid ? materialToPaintId.get(materialGuid) : undefined
		slots.set(rendererId, {
			index: paintIndex + materialIndex,
			offset: paintIndex,
			...(defaultId === undefined ? {} : { defaultId }),
		})
		paintIndex += renderer.materialGuids.length
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
	const geometry = candidate.parts.map(
		({ mesh, matrix, visibility, variant, paint, materials }) => ({
			mesh,
			matrix,
			visibility,
			variant,
			paintIndex: paint?.index,
			// Palette prefab clones differ in default paint, but saved paint slots replace it.
			materials: materials.map((slot) =>
				slot.paintIndex === undefined ? slot : { paintIndex: slot.paintIndex },
			),
		}),
	)
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
		JSON.stringify(left.visibility ?? null).localeCompare(
			JSON.stringify(right.visibility ?? null),
		) ||
		(left.variant?.index ?? -1) - (right.variant?.index ?? -1) ||
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
	const match = body.match(new RegExp(`^  ${escapeRegExp(key)}:[ \\t]*(.*?)[ \\t]*\\r?$`, 'm'))
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

async function loadPaintPalette(
	paintHolderDirectory: string,
	scriptNames: ReadonlyMap<string, string>,
) {
	const [holderNames, assetMetaNames] = await Promise.all([
		listFiles(paintHolderDirectory, '.asset'),
		listFiles(paintHolderDirectory, '.asset.meta'),
	])
	const physicsGuidToName = new Map<string, string>()
	const assetMeta = await mapWithConcurrency(assetMetaNames, 32, async (name) => ({
		name: name.slice(0, -'.asset.meta'.length),
		content: await readFile(join(paintHolderDirectory, name), 'utf8'),
	}))
	for (const { name, content } of assetMeta) {
		const guid = content.match(/^guid:\s*([a-f0-9]+)\s*$/m)?.[1]
		if (guid) physicsGuidToName.set(guid, name.replace(/^\d+\s+-\s+/, ''))
	}
	const parsedHolders = await mapWithConcurrency(holderNames, 32, async (asset) => {
		const body = await readFile(join(paintHolderDirectory, asset), 'utf8')
		const rawPaintId = readScalar(body, 'materialID')
		if (rawPaintId === null) return null
		if (scriptNames.get(readGuidReference(body, 'm_Script') ?? '') !== 'MaterialHolder') {
			throw new Error(`MaterialHolder script metadata unresolved: ${asset}`)
		}
		const paintId = Number(rawPaintId)
		if (!Number.isSafeInteger(paintId)) return null
		return {
			asset,
			paintId,
			materialGuid: readGuidReference(body, 'material'),
			physicsGuid: readGuidReference(body, 'physics'),
		}
	})
	const holders = parsedHolders.filter(
		(holder): holder is NonNullable<typeof holder> => holder !== null,
	)
	const colors: Record<string, [number, number, number]> = {}
	const materialToPaintId = new Map<string, number>()
	const paintMaterials: Record<string, string> = {}
	const conflicts: BlockMeshPaintConflict[] = []
	const physicsErrors: BlockMeshPaintPhysicsError[] = []
	for (const [paintId, entries] of Map.groupBy(holders, ({ paintId }) => paintId)) {
		const surfaces = new Set<string>()
		const materialRefs = new Set(entries.map((entry) => entry.materialGuid))
		if (materialRefs.has(null)) throw new Error(`Missing paint material: ${paintId}`)
		if (materialRefs.size === 1)
			paintMaterials[String(paintId)] = entries[0]?.materialGuid as string
		for (const holder of entries) {
			if (!holder.physicsGuid) {
				physicsErrors.push({
					paintId,
					asset: holder.asset,
					physicsGuid: null,
					reason: 'missing-reference',
				})
				continue
			}
			const surface = physicsGuidToName.get(holder.physicsGuid)
			if (!surface) {
				physicsErrors.push({
					paintId,
					asset: holder.asset,
					physicsGuid: holder.physicsGuid,
					reason: 'unresolved-reference',
				})
				continue
			}
			if (!PHYSICS_SURFACE_COLORS[surface]) {
				physicsErrors.push({
					paintId,
					asset: holder.asset,
					physicsGuid: holder.physicsGuid,
					reason: 'unsupported-surface',
				})
				continue
			}
			surfaces.add(surface)
		}
		if (surfaces.size > 1 || materialRefs.size > 1) {
			conflicts.push({ paintId, assets: entries.map(({ asset }) => asset).sort() })
		} else {
			const surface = surfaces.values().next().value
			const color = surface ? PHYSICS_SURFACE_COLORS[surface] : undefined
			if (color) colors[String(paintId)] = color
		}
		for (const { materialGuid } of entries) {
			if (materialGuid && !materialToPaintId.has(materialGuid)) {
				materialToPaintId.set(materialGuid, paintId)
			}
		}
	}
	physicsErrors.sort(
		(left, right) => left.paintId - right.paintId || left.asset.localeCompare(right.asset),
	)
	return { colors, materialToPaintId, paintMaterials, conflicts, physicsErrors }
}

function srgb(hex: `#${string}`): [number, number, number] {
	const value = Number.parseInt(hex.slice(1), 16)
	return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]
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
