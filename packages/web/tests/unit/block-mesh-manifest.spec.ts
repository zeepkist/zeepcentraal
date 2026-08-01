import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { generateBlockMeshBundle, parseBlockPrefab } from '../../scripts/blockMeshManifest'

const GUID_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const GUID_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const temporaryDirectories: string[] = []

type FixturePart = {
	guid: string
	name: string
	materialGuid?: string
	position?: { x: number; y: number; z: number }
	parentPart?: number
	active?: boolean
	enabled?: boolean
	builtIn?: boolean
	skinned?: boolean
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	)
})

describe('block mesh manifest generator', () => {
	it('resolves block 1490, flattens nested transforms, and ignores root palette position', () => {
		const candidate = parseBlockPrefab(
			prefab({
				blockId: 1490,
				name: '1490 - HW - Fence Straight 1_3d',
				rootPosition: { x: 100, y: 200, z: 300 },
				parts: [
					{ guid: GUID_A, name: 'Parent', position: { x: 2, y: 3, z: 4 } },
					{
						guid: GUID_B,
						name: 'Nested',
						parentPart: 0,
						position: { x: 5, y: 6, z: 7 },
						skinned: true,
					},
				],
			}),
			'1490 - HW - Fence Straight 1_3d.prefab',
		)

		expect(candidate?.blockId).toBe(1490)
		expect(candidate?.parts).toHaveLength(2)
		const parent = candidate?.parts.find(({ name }) => name === 'Parent')
		const nested = candidate?.parts.find(({ name }) => name === 'Nested')
		expect(parent?.matrix.slice(12, 15)).toEqual([-2, 3, 4])
		expect(nested?.matrix.slice(12, 15)).toEqual([-7, 9, 11])
	})

	it('excludes disabled, inactive, and built-in helper geometry', () => {
		const candidate = parseBlockPrefab(
			prefab({
				blockId: 12,
				name: '12 - Filtered',
				parts: [
					{ guid: GUID_A, name: 'Visible' },
					{ guid: GUID_A, name: 'Disabled', enabled: false },
					{ guid: GUID_A, name: 'Inactive', active: false },
					{ guid: GUID_A, name: 'Helper', builtIn: true },
				],
			}),
			'12 - Filtered.prefab',
		)

		expect(candidate?.parts.map(({ name }) => name)).toEqual(['Visible'])
		expect(candidate?.skippedInactiveRendererCount).toBe(2)
		expect(candidate?.skippedBuiltInMeshCount).toBe(1)
	})

	it('includes inactive controlled variants and maps attribute and paint slots', () => {
		const materialGuid = 'cccccccccccccccccccccccccccccccc'
		const candidate = parseBlockPrefab(
			prefab({
				blockId: 98,
				name: '98 - Variants',
				optionMode: 2,
				paintable: true,
				parts: [
					{ guid: GUID_A, name: 'Small', materialGuid },
					{ guid: GUID_B, name: 'Large', materialGuid, active: false },
				],
			}),
			'98 - Variants.prefab',
			new Map([[materialGuid, 403]]),
		)

		expect(candidate?.optionMode).toBe(2)
		expect(candidate?.invalidControllerReasons).toEqual([])
		expect(candidate?.parts).toHaveLength(2)
		expect(candidate?.parts.find(({ name }) => name === 'Small')).toMatchObject({
			attribute: { index: 0, defaultVisible: true },
			paint: { index: 0, defaultId: 403 },
		})
		expect(candidate?.parts.find(({ name }) => name === 'Large')).toMatchObject({
			attribute: { index: 1, defaultVisible: false },
			paint: { index: 1, defaultId: 403 },
		})
	})

	it('copies shared meshes once, collapses matching duplicates, and reports bad and unresolved data', async () => {
		const fixture = await createDirectories()
		await Promise.all([
			writeFile(
				join(fixture.gameObjects, '1490 - HW - Fence Straight 1_3d.prefab'),
				prefab({
					blockId: 1490,
					name: '1490 - HW - Fence Straight 1_3d',
					parts: [{ guid: GUID_A, name: 'Fence' }],
				}),
			),
			writeFile(
				join(fixture.gameObjects, 'Fence Blue.prefab'),
				prefab({
					blockId: 1490,
					name: 'Fence Blue',
					parts: [{ guid: GUID_A, name: 'Fence Blue' }],
				}),
			),
			writeFile(
				join(fixture.gameObjects, '2000 - Shared.prefab'),
				prefab({
					blockId: 2000,
					name: '2000 - Shared',
					parts: [{ guid: GUID_A, name: 'Shared' }],
				}),
			),
			writeFile(
				join(fixture.gameObjects, '2001 - Missing.prefab'),
				prefab({
					blockId: 2001,
					name: '2001 - Missing',
					parts: [{ guid: GUID_B, name: 'Missing' }],
				}),
			),
			writeFile(
				join(fixture.gameObjects, 'BAD1490 Duplicate.prefab'),
				prefab({ blockId: 1490, name: 'BAD1490', parts: [{ guid: GUID_B, name: 'Bad' }] }),
			),
			writeFile(
				join(fixture.assetMeshes, 'HW - Fence Straight 1_3d.asset.meta'),
				`guid: ${GUID_A}\n`,
			),
			writeFile(join(fixture.glbMeshes, 'HW - Fence Straight 1_3d.glb'), 'glb'),
		])

		const { manifest, report } = await generateBlockMeshBundle({
			gameObjectDirectory: fixture.gameObjects,
			assetMeshDirectory: fixture.assetMeshes,
			glbMeshDirectory: fixture.glbMeshes,
			paintHolderDirectory: fixture.paintHolders,
			outputDirectory: fixture.output,
		})

		expect(manifest.blocks['1490']).toEqual({
			name: '1490 - HW - Fence Straight 1_3d',
			parts: [{ mesh: GUID_A, matrix: identityMatrix(), name: 'Fence' }],
		})
		expect(manifest.blocks['2000']?.parts[0]?.mesh).toBe(GUID_A)
		expect(manifest.blocks['2001']?.parts).toEqual([])
		expect(await readdir(join(fixture.output, 'meshes'))).toEqual([`${GUID_A}.glb`])
		expect(report.meshCount).toBe(1)
		expect(report.skippedBadPrefabs).toEqual(['BAD1490 Duplicate.prefab'])
		expect(report.unresolvedReferences).toEqual([
			{ blockId: 2001, guid: GUID_B, prefab: '2001 - Missing.prefab' },
		])
		expect(JSON.parse(await readFile(join(fixture.output, 'manifest.json'), 'utf8'))).toEqual(
			manifest,
		)
	})

	it('derives all paint colors from physics assets and keeps renderer default paint IDs', async () => {
		const fixture = await createDirectories()
		const surfaces = [
			{ paintId: 0, name: 'Tarmac', hex: '#8B929A' },
			{ paintId: 1, name: 'Ice 0.05', hex: '#D9F4FF' },
			{ paintId: 2, name: 'Ice 0.10', hex: '#A9DDF5' },
			{ paintId: 3, name: 'Ice 0.15', hex: '#69B7E8' },
			{ paintId: 4, name: 'Sand', hex: '#E8C77B' },
			{ paintId: 5, name: 'Mud', hex: '#B9825A' },
			{ paintId: 90, name: 'Grass', hex: '#8FCB7B' },
			{ paintId: 7, name: 'Wood', hex: '#C99562' },
			{ paintId: 8, name: 'Soap', hex: '#EAA3BC' },
		] as const
		const grassMaterialGuid = fixtureGuid(190)
		await Promise.all([
			writeFile(
				join(fixture.gameObjects, '98 - Painted.prefab'),
				prefab({
					blockId: 98,
					name: '98 - Painted',
					paintable: true,
					parts: [{ guid: GUID_A, name: 'Painted', materialGuid: grassMaterialGuid }],
				}),
			),
			writeFile(join(fixture.assetMeshes, 'Painted.asset.meta'), `guid: ${GUID_A}\n`),
			writeFile(join(fixture.glbMeshes, 'Painted.glb'), 'glb'),
			...surfaces.flatMap(({ paintId, name }, index) => {
				const physicsGuid = fixtureGuid(index + 1)
				const materialGuid = name === 'Grass' ? grassMaterialGuid : fixtureGuid(index + 101)
				return [
					writeFile(
						join(fixture.paintHolders, `${paintId} - ${name}.asset`),
						paintHolder({ paintId, materialGuid, physicsGuid }),
					),
					writeFile(
						join(fixture.paintHolders, `${name}.asset.meta`),
						`guid: ${physicsGuid}\n`,
					),
				]
			}),
		])

		const { manifest, report } = await generateBlockMeshBundle({
			gameObjectDirectory: fixture.gameObjects,
			assetMeshDirectory: fixture.assetMeshes,
			glbMeshDirectory: fixture.glbMeshes,
			paintHolderDirectory: fixture.paintHolders,
			outputDirectory: fixture.output,
		})

		expect(manifest.paints).toEqual(
			Object.fromEntries(surfaces.map(({ paintId, hex }) => [paintId, srgb(hex)])),
		)
		expect(manifest.paints['90']).toEqual(srgb('#8FCB7B'))
		expect(manifest.blocks['98']?.parts[0]?.paint).toEqual({ index: 0, defaultId: 90 })
		expect(report.paintConflicts).toEqual([])
		expect(report.paintPhysicsErrors).toEqual([])
	})

	it('reports missing, unresolved, unsupported, and conflicting paint physics', async () => {
		const fixture = await createDirectories()
		const tarmacGuid = fixtureGuid(1)
		const grassGuid = fixtureGuid(2)
		const unsupportedGuid = fixtureGuid(3)
		const unresolvedGuid = fixtureGuid(4)
		await Promise.all([
			writeFile(join(fixture.paintHolders, 'Tarmac.asset.meta'), `guid: ${tarmacGuid}\n`),
			writeFile(join(fixture.paintHolders, 'Grass.asset.meta'), `guid: ${grassGuid}\n`),
			writeFile(join(fixture.paintHolders, 'Metal.asset.meta'), `guid: ${unsupportedGuid}\n`),
			writeFile(
				join(fixture.paintHolders, '1 - Same A.asset'),
				paintHolder({
					paintId: 1,
					materialGuid: fixtureGuid(101),
					physicsGuid: tarmacGuid,
				}),
			),
			writeFile(
				join(fixture.paintHolders, '1 - Same B.asset'),
				paintHolder({
					paintId: 1,
					materialGuid: fixtureGuid(102),
					physicsGuid: tarmacGuid,
				}),
			),
			writeFile(
				join(fixture.paintHolders, '2 - Conflict A.asset'),
				paintHolder({
					paintId: 2,
					materialGuid: fixtureGuid(103),
					physicsGuid: tarmacGuid,
				}),
			),
			writeFile(
				join(fixture.paintHolders, '2 - Conflict B.asset'),
				paintHolder({ paintId: 2, materialGuid: fixtureGuid(104), physicsGuid: grassGuid }),
			),
			writeFile(
				join(fixture.paintHolders, '3 - Missing.asset'),
				paintHolder({ paintId: 3, materialGuid: fixtureGuid(105) }),
			),
			writeFile(
				join(fixture.paintHolders, '4 - Unresolved.asset'),
				paintHolder({
					paintId: 4,
					materialGuid: fixtureGuid(106),
					physicsGuid: unresolvedGuid,
				}),
			),
			writeFile(
				join(fixture.paintHolders, '5 - Unsupported.asset'),
				paintHolder({
					paintId: 5,
					materialGuid: fixtureGuid(107),
					physicsGuid: unsupportedGuid,
				}),
			),
		])

		const { manifest, report } = await generateBlockMeshBundle({
			gameObjectDirectory: fixture.gameObjects,
			assetMeshDirectory: fixture.assetMeshes,
			glbMeshDirectory: fixture.glbMeshes,
			paintHolderDirectory: fixture.paintHolders,
			outputDirectory: fixture.output,
		})

		expect(manifest.paints).toEqual({ 1: srgb('#8B929A') })
		expect(report.paintConflicts).toEqual([
			{
				paintId: 2,
				assets: ['2 - Conflict A.asset', '2 - Conflict B.asset'],
			},
		])
		expect(report.paintPhysicsErrors).toEqual([
			{
				paintId: 3,
				asset: '3 - Missing.asset',
				physicsGuid: null,
				reason: 'missing-reference',
			},
			{
				paintId: 4,
				asset: '4 - Unresolved.asset',
				physicsGuid: unresolvedGuid,
				reason: 'unresolved-reference',
			},
			{
				paintId: 5,
				asset: '5 - Unsupported.asset',
				physicsGuid: unsupportedGuid,
				reason: 'unsupported-surface',
			},
		])
	})

	it('rejects conflicting duplicate block geometry', async () => {
		const fixture = await createDirectories()
		await Promise.all([
			writeFile(
				join(fixture.gameObjects, '3000 - Canonical.prefab'),
				prefab({
					blockId: 3000,
					name: '3000 - Canonical',
					parts: [{ guid: GUID_A, name: 'A' }],
				}),
			),
			writeFile(
				join(fixture.gameObjects, '3000 Red.prefab'),
				prefab({ blockId: 3000, name: '3000 Red', parts: [{ guid: GUID_B, name: 'B' }] }),
			),
		])

		const { manifest, report } = await generateBlockMeshBundle({
			gameObjectDirectory: fixture.gameObjects,
			assetMeshDirectory: fixture.assetMeshes,
			glbMeshDirectory: fixture.glbMeshes,
			paintHolderDirectory: fixture.paintHolders,
			outputDirectory: fixture.output,
			copyMeshes: false,
		})

		expect(manifest.blocks['3000']).toBeUndefined()
		expect(report.conflicts).toEqual([
			{
				blockId: 3000,
				prefabs: ['3000 - Canonical.prefab', '3000 Red.prefab'],
			},
		])
	})
})

function prefab(options: {
	blockId: number
	name: string
	parts: FixturePart[]
	rootPosition?: { x: number; y: number; z: number }
	optionMode?: 0 | 1 | 2
	paintable?: boolean
}) {
	const rootPosition = options.rootPosition ?? { x: 0, y: 0, z: 0 }
	const documents = [
		gameObjectDocument(1, options.name),
		transformDocument(2, 1, 0, rootPosition),
		`--- !u!114 &3\nMonoBehaviour:\n  m_GameObject: {fileID: 1}\n  blockID: ${options.blockId}\n`,
	]
	for (const [index, part] of options.parts.entries()) {
		const gameObjectId = 10 + index * 10
		const transformId = gameObjectId + 1
		const parentTransformId = part.parentPart === undefined ? 2 : 11 + part.parentPart * 10
		documents.push(
			gameObjectDocument(gameObjectId, part.name, part.active),
			transformDocument(
				transformId,
				gameObjectId,
				parentTransformId,
				part.position ?? { x: 0, y: 0, z: 0 },
			),
		)
		const meshReference = part.builtIn
			? '{fileID: 10202}'
			: `{fileID: 4300000, guid: ${part.guid}, type: 2}`
		if (part.skinned) {
			documents.push(
				`--- !u!137 &${gameObjectId + 2}\nSkinnedMeshRenderer:\n  m_GameObject: {fileID: ${gameObjectId}}\n  m_Enabled: ${part.enabled === false ? 0 : 1}\n  m_Mesh: ${meshReference}\n`,
			)
		} else {
			const materials = part.materialGuid
				? `  m_Materials:\n  - {fileID: 2100000, guid: ${part.materialGuid}, type: 2}\n`
				: ''
			documents.push(
				`--- !u!33 &${gameObjectId + 2}\nMeshFilter:\n  m_GameObject: {fileID: ${gameObjectId}}\n  m_Mesh: ${meshReference}\n`,
				`--- !u!23 &${gameObjectId + 3}\nMeshRenderer:\n  m_GameObject: {fileID: ${gameObjectId}}\n  m_Enabled: ${part.enabled === false ? 0 : 1}\n${materials}`,
			)
		}
	}
	if (options.optionMode !== undefined) {
		documents.push(
			`--- !u!114 &4\nMonoBehaviour:\n  m_GameObject: {fileID: 1}\n  m_Script: {fileID: 11500000, guid: b4261eb191488cc43931530c16db9ab5, type: 3}\n  blockPieces:\n${options.parts.map((_, index) => `  - {fileID: ${10 + index * 10}}`).join('\n')}\n  blockPieceBridgeNR: ${packedInt32(options.parts.map((_, index) => index))}\n  blockMode: ${options.optionMode}\n`,
		)
	}
	if (options.paintable) {
		documents.push(
			`--- !u!114 &5\nMonoBehaviour:\n  m_GameObject: {fileID: 1}\n  m_Script: {fileID: 11500000, guid: 3527f1b5ed7e63940af875bd424d8b18, type: 3}\n  renderers:\n${options.parts.map((_, index) => `  - {fileID: ${13 + index * 10}}`).join('\n')}\n  optionalLeadingPhsxMaterialIndex: ${packedInt32(options.parts.map(() => 0))}\n`,
		)
	}
	return documents.join('')
}

function packedInt32(values: number[]) {
	const bytes = Buffer.alloc(values.length * 4)
	for (const [index, value] of values.entries()) bytes.writeInt32LE(value, index * 4)
	return bytes.toString('hex')
}

function gameObjectDocument(id: number, name: string, active = true) {
	return `--- !u!1 &${id}\nGameObject:\n  m_Name: ${name}\n  m_IsActive: ${active ? 1 : 0}\n`
}

function transformDocument(
	id: number,
	gameObjectId: number,
	parentId: number,
	position: { x: number; y: number; z: number },
) {
	return `--- !u!4 &${id}\nTransform:\n  m_GameObject: {fileID: ${gameObjectId}}\n  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}\n  m_LocalPosition: {x: ${position.x}, y: ${position.y}, z: ${position.z}}\n  m_LocalScale: {x: 1, y: 1, z: 1}\n  m_Father: {fileID: ${parentId}}\n`
}

async function createDirectories() {
	const root = await mkdtemp(join(tmpdir(), 'block-mesh-manifest-'))
	temporaryDirectories.push(root)
	const gameObjects = join(root, 'GameObject')
	const assetMeshes = join(root, 'AssetMeshes')
	const glbMeshes = join(root, 'GlbMeshes')
	const paintHolders = join(root, 'PaintHolders')
	const output = join(root, 'Output')
	await Promise.all([
		mkdir(gameObjects),
		mkdir(assetMeshes),
		mkdir(glbMeshes),
		mkdir(paintHolders),
	])
	return { gameObjects, assetMeshes, glbMeshes, paintHolders, output }
}

function identityMatrix() {
	return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

function paintHolder(options: { paintId: number; materialGuid: string; physicsGuid?: string }) {
	const physics = options.physicsGuid
		? `  physics: {fileID: 11400000, guid: ${options.physicsGuid}, type: 2}\n`
		: ''
	return `--- !u!114 &11400000\nMonoBehaviour:\n  m_Script: {fileID: 11500000, guid: 6e47a3d5d8751ec41921d7b6a3037763, type: 3}\n  materialID: ${options.paintId}\n  material: {fileID: 2100000, guid: ${options.materialGuid}, type: 2}\n${physics}`
}

function fixtureGuid(value: number) {
	return value.toString(16).padStart(32, '0')
}

function srgb(hex: string) {
	const value = Number.parseInt(hex.slice(1), 16)
	return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]
}
