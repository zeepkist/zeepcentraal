import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import * as THREE from 'three'
import {
	calculateRootRelativeMatrix,
	composeUnityTransform,
	loadUnityScriptCatalog,
	parseOptionController,
	parseUnityDocuments,
	readFileId,
	readFileIdList,
	readGuidReference,
	readMeshReference,
	readScalar,
	readVector,
	type UnityGameObject,
	type UnityTransform,
} from './blockMeshManifest'
import { parseGlb } from './protectedBlockMeshCorpus'

export const validationBlockIds = [
	1, 1363, 2256, 2259, 2, 1273, 1274, 1412, 1616, 22, 372, 373, 1275, 1276, 1277, 1278, 1279,
	1615, 1607, 1608, 1609, 1610, 1611, 1612, 1613, 1614, 1978, 1979, 1980, 1981, 1982, 1983, 1984,
	1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
]
export type ValidationBlock = {
	spawns: number[][]
	colliders: Array<{
		shape: string
		vertices: number[][]
		attributes: string[]
		convex: boolean
		cookingOptions: number
		planeNormal: number[]
		timing: string
	}>
	unsupported: string[]
}

/** Resolve rendering components from the same export, not old hard-coded GUIDs. */
export async function extendValidationScriptCatalog(
	directory: string,
	scripts: Map<string, string>,
	digest: ReturnType<typeof createHash>,
) {
	for (const assembly of ['HxVolumetricLighting', 'Unity.TextMeshPro']) {
		const root = join(dirname(directory), assembly)
		let files: string[]
		try {
			files = await readdir(root, { recursive: true })
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
			throw error
		}
		for (const file of files.filter((name) => name.endsWith('.cs.meta')).sort()) {
			const metadata = await readFile(join(root, file), 'utf8')
			const guid = metadata.match(/^guid:\s*([a-f0-9]{32})\s*$/m)?.[1]
			if (!guid) throw new Error(`Unity script metadata missing GUID: ${file}`)
			const source = file.slice(0, -'.meta'.length)
			const bytes = await readFile(join(root, source))
			const name = basename(source, '.cs')
			if (scripts.has(guid)) throw new Error(`Unity script metadata repeats GUID: ${file}`)
			scripts.set(guid, name)
			digest.update(`${assembly}/${file}`).update(metadata).update(bytes)
		}
	}
}

/** Separate physics activation from renderer visibility. No hideTrigger/hideLogic render rules. */
export async function extractValidationBlock(
	content: string,
	scripts: ReadonlyMap<string, string>,
	mesh: (guid: string) => Promise<number[][]>,
): Promise<{ id: number; block: ValidationBlock } | null> {
	const documents = parseUnityDocuments(content)
	const objects = new Map<string, UnityGameObject>()
	const transforms = new Map<string, UnityTransform>()
	const byObject = new Map<string, UnityTransform>()
	const behaviours = documents.filter((d) => d.type === 114)
	const name = (body: string) => scripts.get(readGuidReference(body, 'm_Script') ?? '')
	const properties = behaviours.find((d) => name(d.body) === 'BlockProperties')
	if (!properties) return null
	const id = Number(readScalar(properties.body, 'blockID'))
	if (!validationBlockIds.includes(id)) return null
	for (const d of documents) {
		if (d.type === 1)
			objects.set(d.id, {
				id: d.id,
				name: readScalar(d.body, 'm_Name') ?? '',
				active: readScalar(d.body, 'm_IsActive') !== '0',
			})
		if (d.type === 4) {
			const object = readFileId(d.body, 'm_GameObject') ?? ''
			const parent = readFileId(d.body, 'm_Father')
			const transform = {
				id: d.id,
				gameObjectId: object,
				parentId: parent === '0' ? null : parent,
				localMatrix: composeUnityTransform(d.body),
			}
			transforms.set(d.id, transform)
			byObject.set(object, transform)
		}
	}
	const root = byObject.get(readFileId(properties.body, 'm_GameObject') ?? '')
	if (!root) throw new Error(`Missing validation root ${id}`)
	const block: ValidationBlock = { spawns: [], colliders: [], unsupported: [] }
	const attributes = new Map<string, string>()
	for (const d of behaviours) {
		const script = name(d.body)
		if (!script) {
			block.unsupported.push('unresolved_script')
			continue
		}
		if (script === 'BlockEdit_RoadABCD_NEW' || script === 'BlockEdit_v18_RoadABCD') {
			const controller = parseOptionController([d.body], objects, block.unsupported)
			for (const [object, option] of controller.controlledGameObjects) {
				attributes.set(object, `a${option.attributeIndex}`)
				const target = objects.get(object)
				if (target) target.active = true
			}
		}
		if (script === 'BlockEdit_DisableGameObjects' || script === 'InvisibleBlockScript') {
			for (const object of readFileIdList(d.body, 'editorObjects')) {
				const target = objects.get(object)
				if (target) target.active = false
			}
			for (const object of readFileIdList(
				d.body,
				script === 'InvisibleBlockScript' ? 'gamesObjects' : 'playerObjects',
			)) {
				const target = objects.get(object)
				if (target) target.active = true
			}
		}
		if (script === 'PlaceDynamicObject' || script.startsWith('BlockEdit_v18_C_Logic_'))
			block.unsupported.push('dynamic_or_logic_controlled')
	}
	const path = (object: string) => {
		const parts: string[] = []
		const conditions: string[] = []
		const visited = new Set<string>()
		let transform = byObject.get(object)
		while (transform && transform.id !== root.id) {
			if (visited.has(transform.id)) return null
			visited.add(transform.id)
			const state = objects.get(transform.gameObjectId)
			if (!state?.active) return null
			parts.unshift(state.name)
			const attribute = attributes.get(transform.gameObjectId)
			if (attribute) conditions.push(attribute)
			transform = transforms.get(transform.parentId ?? '')
		}
		return transform ? { shape: parts.join('/'), attributes: conditions } : null
	}
	for (const d of behaviours) {
		const spawnIds = [
			readFileId(d.body, 'spawn1P'),
			...['spawns2P', 'spawns3P', 'spawns4P'].flatMap((key) => readFileIdList(d.body, key)),
		]
		for (const spawnId of spawnIds) {
			const transform = transforms.get(spawnId ?? '')
			if (!transform) continue
			const matrix = calculateRootRelativeMatrix(
				transform.gameObjectId,
				root.id,
				transforms,
				byObject,
			)
			if (matrix) block.spawns.push(new THREE.Vector3().applyMatrix4(matrix).toArray())
		}
		if (name(d.body) !== 'BlockTriggerFinishOrCheckpoint') continue
		const object = readFileId(d.body, 'm_GameObject') ?? ''
		const activation = path(object)
		if (!activation) continue
		const collider = documents.find(
			(c) => c.type === 64 && readFileId(c.body, 'm_GameObject') === object,
		)
		const guid = collider ? readMeshReference(collider.body).guid : null
		const matrix = calculateRootRelativeMatrix(object, root.id, transforms, byObject)
		if (
			readScalar(d.body, 'm_Enabled') === '0' &&
			![
				1607, 1608, 1609, 1610, 1611, 1612, 1613, 1614, 1978, 1979, 1980, 1981, 1982, 1983,
				1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
			].includes(id)
		)
			block.unsupported.push('disabled_trigger_activation')
		if (!collider || !guid || !matrix || readScalar(collider.body, 'm_IsTrigger') !== '1') {
			block.unsupported.push('unsupported_collider')
			continue
		}
		try {
			const vertices = (await mesh(guid)).map((point) =>
				new THREE.Vector3().fromArray(point).applyMatrix4(matrix).toArray(),
			)
			const normal = readVector(d.body, 'planeNormal', { x: 0, y: 0, z: 0 })
			block.colliders.push({
				...activation,
				vertices,
				convex: readScalar(collider.body, 'm_Convex') === '1',
				cookingOptions: Number(readScalar(collider.body, 'm_CookingOptions')),
				planeNormal: [normal.x, normal.y, normal.z],
				timing:
					readScalar(d.body, 'usePlaneAccuracy') === '1'
						? 'plane'
						: readScalar(d.body, 'useShapeAccuracy') === '1'
							? 'shape'
							: 'none',
			})
		} catch {
			block.unsupported.push('missing_collider_mesh')
		}
	}
	block.unsupported = [...new Set(block.unsupported)].sort()
	return { id, block }
}

async function* readSources(directory: string, names: string[]): AsyncGenerator<[string, Buffer]> {
	for (let i = 0; i < names.length; i += 32) {
		const batch = await Promise.all(
			names
				.slice(i, i + 32)
				.map(
					async (name): Promise<[string, Buffer]> => [
						name,
						await readFile(join(directory, name)),
					],
				),
		)
		for (const entry of batch) yield entry
	}
}

export async function generateValidationManifest(options: {
	gameObjectDirectory: string
	scriptDirectory: string
	assetMeshDirectory: string
	glbMeshDirectory: string
	gameVersion: string
	output: string
}) {
	const scripts = await loadUnityScriptCatalog(options.scriptDirectory)
	const digest = createHash('sha256')
	await extendValidationScriptCatalog(options.scriptDirectory, scripts, digest)
	// Folder names do not identify a game build. Verify matching exported game metadata.
	const project = dirname(dirname(dirname(options.scriptDirectory)))
	let physicsInterval = 0.011
	for (const [name, file] of [
		['version', join(project, 'Assets', 'MonoBehaviour', 'VersionSO.asset')],
		['timing', join(project, 'ProjectSettings', 'TimeManager.asset')],
	] as const) {
		let source: string
		try {
			source = await readFile(file, 'utf8')
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
			throw error
		}
		digest.update(name).update(source)
		if (name === 'version') {
			const major = source.match(/^\s*version:\s*(\d+)\s*$/m)?.[1]
			const patch = source.match(/^\s*patch:\s*(\d+)\s*$/m)?.[1]
			if (!major || !patch || `${major}.${patch}` !== options.gameVersion)
				throw new Error(
					`Export game version ${major}.${patch} does not match requested ${options.gameVersion}`,
				)
		} else {
			physicsInterval = Number(source.match(/^\s*Fixed Timestep:\s*([\d.]+)\s*$/m)?.[1])
			if (!Number.isFinite(physicsInterval) || physicsInterval <= 0 || physicsInterval > 0.1)
				throw new Error('Invalid exported physics interval')
		}
	}
	for await (const [file, bytes] of readSources(
		options.scriptDirectory,
		(await readdir(options.scriptDirectory))
			.filter((f) => f.endsWith('.cs') || f.endsWith('.cs.meta'))
			.sort(),
	))
		digest.update(file).update(bytes)
	const meshes = new Map<string, string>()
	for await (const [file, bytes] of readSources(
		options.assetMeshDirectory,
		(await readdir(options.assetMeshDirectory)).filter((f) => f.endsWith('.asset.meta')).sort(),
	)) {
		const guid = bytes.toString('utf8').match(/^guid:\s*([a-f0-9]+)/m)?.[1]
		if (guid) meshes.set(guid, file.slice(0, -'.asset.meta'.length))
	}
	const blocks: Record<string, ValidationBlock> = {}
	const mesh = async (guid: string) => {
		const stem = meshes.get(guid)
		if (!stem) throw new Error('Missing collider mesh')
		const bytes = await readFile(join(options.glbMeshDirectory, `${stem}.glb`))
		digest.update(guid).update(bytes)
		const points = new Map<string, number[]>()
		for (const primitive of parseGlb(bytes, stem).primitives)
			for (let i = 0; i < primitive.positions.length; i += 3) {
				const p = Array.from(primitive.positions.slice(i, i + 3))
				points.set(p.join(','), p)
			}
		return [...points.values()]
	}
	for await (const [file, bytes] of readSources(
		options.gameObjectDirectory,
		(await readdir(options.gameObjectDirectory)).filter((f) => f.endsWith('.prefab')).sort(),
	)) {
		const content = bytes.toString('utf8')
		if (
			![...content.matchAll(/^ {2}blockID: (\d+)$/gm)].some((m) =>
				validationBlockIds.includes(Number(m[1])),
			)
		)
			continue
		const result = await extractValidationBlock(content, scripts, mesh)
		if (!result) continue
		digest.update(file).update(content)
		const existing = blocks[result.id]
		if (existing && JSON.stringify(existing) !== JSON.stringify(result.block)) {
			existing.unsupported.push('conflicting_prefabs')
			continue
		}
		blocks[result.id] = result.block
	}
	// Tolerances are provisional. Export can never enable enforcement without calibration.
	const manifest = {
		version: 1,
		gameVersion: options.gameVersion,
		sourceDigest: digest.digest('hex'),
		calibrated: false,
		// Revision-3 captures distinguish normal TopSphereMan from ragdoll TopSphereMan.
		// Provisional capture-derived radii; matching export/game calibration remains required.
		sphereRadius: 0.27,
		ragdollSphereRadius: 0.3,
		physicsInterval,
		positionTolerance: 0.02,
		spawnTolerance: 5,
		blocks,
	}
	await writeFile(options.output, JSON.stringify(manifest))
	return manifest
}
