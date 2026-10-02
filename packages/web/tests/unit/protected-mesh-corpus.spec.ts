import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MeshoptDecoder } from 'meshoptimizer/decoder'
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	parseProtectedGhostModelBundle,
	parseProtectedLevelMeshBundle,
} from '../../app/utils/protectedMeshLibrary.client'
import { compileProtectedBlockMeshCorpus } from '../../scripts/protectedBlockMeshCorpus'
import {
	buildProtectedGhostModelBundle,
	buildProtectedLevelMeshBundle,
	clearProtectedMeshCorpusCaches,
	protectedMeshBundleCacheKey,
	protectedMeshCorpusDigest,
	selectProtectedMeshParts,
} from '../../server/utils/protectedMeshCorpus'
import type {
	ProtectedMeshCorpusIndex,
	ProtectedMeshMatrix,
} from '../../shared/protectedMeshFormat'

const temporaryDirectories: string[] = []
const sourceGuid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const originalFetch = globalThis.fetch
const originalCreateError = globalThis.createError

afterEach(async () => {
	clearProtectedMeshCorpusCaches()
	globalThis.fetch = originalFetch
	globalThis.createError = originalCreateError
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	)
})

describe('protected mesh corpus compiler', () => {
	it('maps Unity submeshes independently of GLB material indices and retains saved finishes', async () => {
		const root = await mkdtemp(join(tmpdir(), 'protected-native-material-'))
		temporaryDirectories.push(root)
		const bundle = join(root, 'bundle'),
			models = join(root, 'models'),
			output = join(root, 'output')
		await Promise.all([mkdir(join(bundle, 'meshes'), { recursive: true }), mkdir(models)])
		const ice = {
			color: [1, 1, 1],
			specular: [0.09, 0.52, 0.67],
			opacity: 1,
			roughness: 0.075,
			metalness: 0,
			workflow: 'specular',
			transparent: false,
			doubleSided: false,
		}
		const glass = {
			...ice,
			color: [0.2, 0.3, 0.75],
			opacity: 0.5,
			workflow: 'metallic',
			transparent: true,
		}
		await writeFile(
			join(bundle, 'manifest.json'),
			JSON.stringify({
				version: 4,
				paints: { 403: [0.25, 0.5, 0.75], 404: [0.25, 0.5, 0.75] },
				materials: { ice, glass },
				paintMaterials: { 403: 'ice', 404: 'glass' },
				submeshCounts: { [sourceGuid]: 2 },
				blocks: {
					0: {
						parts: [
							{
								mesh: sourceGuid,
								matrix: identity(),
								paint: { index: 0, defaultId: 403 },
								materials: [
									{ material: 'ice', paintIndex: 0 },
									{ material: 'glass', paintIndex: 1 },
									{ material: 'ice', paintIndex: 2 },
								],
							},
						],
					},
					1326: { parts: [] },
				},
			}),
		)
		await writeFile(join(bundle, 'meshes', `${sourceGuid}.glb`), triangleGlb(identity(), 2))
		await Promise.all(
			['axle', 'character', 'soapbox', 'spoiler', 'wheel'].map((name) =>
				writeFile(join(models, `${name}.stl`), triangleStl()),
			),
		)
		await compileProtectedBlockMeshCorpus({
			bundleDirectory: bundle,
			ghostModelDirectory: models,
			outputDirectory: output,
		})
		await MeshoptDecoder.ready
		const block = {
			id: 0,
			position: { x: 0, y: 0, z: 0 },
			rotation: { x: 0, y: 0, z: 0 },
			scale: { x: 1, y: 1, z: 1 },
			attributes: {},
			paints: {},
		}
		const bytes = await buildProtectedLevelMeshBundle(output, [
			block,
			{ ...block, paints: { 0: 404, 1: 403 } },
			{ ...block, id: 1326 },
		])
		expect(new DataView(bytes.buffer).getUint16(4, true)).toBe(4)
		const parsed = parseProtectedLevelMeshBundle(bytes)
		expect(parsed.groups).toHaveLength(2)
		expect(parsed.fallbackMatrices).toHaveLength(0)
		expect(parsed.groups[0]?.materials[0]?.workflow).toBe('specular')
		expect(parsed.groups[0]?.materials[1]?.opacity).toBeCloseTo(0.5)
		expect(parsed.groups[0]?.primitives[2]?.nativeOnly).toBe(true)
		expect(parsed.groups[1]?.materials[0]?.color[2]).toBeCloseTo(0.75)
		expect(parsed.groups[1]?.materials[1]?.specular[1]).toBeCloseTo(0.52)
		const common = await buildProtectedGhostModelBundle(output)
		expect(new DataView(common.buffer).getUint16(4, true)).toBe(3)
		expect(
			parseProtectedGhostModelBundle(common).body.getAttribute('position').count,
		).toBeGreaterThan(0)
		const manifest = JSON.parse(await readFile(join(bundle, 'manifest.json'), 'utf8'))
		manifest.submeshCounts[sourceGuid] = 3
		await writeFile(join(bundle, 'manifest.json'), JSON.stringify(manifest))
		await expect(
			compileProtectedBlockMeshCorpus({
				bundleDirectory: bundle,
				ghostModelDirectory: models,
				outputDirectory: output,
			}),
		).rejects.toThrow('Ambiguous Unity/GLB submesh mapping')
	})
	it('loads saved attributes without applying editor toggle constraints', () => {
		const parts = [
			{ materials: [], mesh: 'uncontrolled', matrix: identity() },
			{
				materials: [],
				mesh: 'small',
				matrix: identity(),
				visibility: [{ kind: 'attribute' as const, index: 0 }],
			},
			{
				materials: [],
				mesh: 'large',
				matrix: identity(),
				visibility: [{ kind: 'attribute' as const, index: 1 }],
			},
		]
		const selected = (optionMode: 0 | 1 | 2, attributes: Record<number, number>) =>
			selectProtectedMeshParts({ optionMode, parts }, { attributes }).map(({ mesh }) => mesh)

		expect(selected(2, {})).toEqual(['uncontrolled'])
		expect(selected(2, { 1: 1 })).toEqual(['uncontrolled', 'large'])
		expect(selected(2, { 0: 1, 1: 1 })).toEqual(['uncontrolled', 'small', 'large'])
		expect(selected(0, { 7: 1 })).toEqual(['uncontrolled'])
		expect(selected(1, { 0: 0 })).toEqual(['uncontrolled'])
		expect(selected(0, { 0: -3, 1: 2 })).toEqual(['uncontrolled', 'small', 'large'])
	})

	it('combines ancestor conditions, gameplay hiding, and clamped mesh variants', () => {
		const definition: ProtectedMeshCorpusIndex['blocks'][string] = {
			parts: [
				{
					materials: [],
					mesh: 'nested',
					matrix: identity(),
					visibility: [
						{ kind: 'attribute', index: 0 },
						{ kind: 'attribute', index: 1 },
					],
				},
				{
					materials: [],
					mesh: 'chip',
					matrix: identity(),
					visibility: [{ kind: 'hideLogicBlock' }],
				},
				{
					materials: [],
					mesh: 'trigger',
					matrix: identity(),
					visibility: [{ kind: 'hideTrigger' }],
				},
				{
					materials: [],
					mesh: 'variant0',
					matrix: identity(),
					variant: { index: 0, count: 2 },
				},
				{
					materials: [],
					mesh: 'variant1',
					matrix: identity(),
					variant: { index: 1, count: 2 },
				},
			],
		}
		const selected = (options: Parameters<typeof selectProtectedMeshParts>[1]) =>
			selectProtectedMeshParts(definition, options).map((part) => part.mesh)
		expect(selected({ attributes: { 1: 1 } })).toEqual(['chip', 'trigger', 'variant0'])
		expect(
			selected({
				attributes: { 0: 1, 1: 1 },
				hideLogicBlock: true,
				hideTrigger: true,
				meshVariant: 99,
			}),
		).toEqual(['nested', 'variant1'])
		expect(selected({ attributes: {}, meshVariant: -1 })).toEqual([
			'chip',
			'trigger',
			'variant0',
		])
	})

	it('includes attributes, paints, variants, and hiding in protected bundle cache identity', () => {
		const block = {
			id: 98,
			position: { x: 0, y: 0, z: 0 },
			rotation: { x: 0, y: 0, z: 0 },
			scale: { x: 1, y: 1, z: 1 },
			attributes: { 0: 1 },
			paints: { 0: 403 },
		}
		const original = protectedMeshBundleCacheKey('digest', [block])
		expect(
			protectedMeshBundleCacheKey('digest', [{ ...block, attributes: { 1: 1 } }]),
		).not.toBe(original)
		expect(protectedMeshBundleCacheKey('digest', [{ ...block, paints: { 0: 285 } }])).not.toBe(
			original,
		)
		for (const options of [
			{ meshVariant: 1 },
			{ hideLogicBlock: true },
			{ hideTrigger: true },
		]) {
			expect(protectedMeshBundleCacheKey('digest', [{ ...block, ...options }])).not.toBe(
				original,
			)
		}
	})

	it('preserves visibility and variants through compilation and bundle selection', async () => {
		const root = await mkdtemp(join(tmpdir(), 'protected-mesh-gameplay-'))
		temporaryDirectories.push(root)
		const bundle = join(root, 'bundle')
		const models = join(root, 'models')
		const output = join(root, 'output')
		await Promise.all([mkdir(join(bundle, 'meshes'), { recursive: true }), mkdir(models)])
		const parts: ProtectedMeshCorpusIndex['blocks'][string]['parts'] = [
			{
				materials: [],
				mesh: sourceGuid,
				matrix: identity(),
				visibility: [
					{ kind: 'attribute', index: 0 },
					{ kind: 'attribute', index: 1 },
				],
			},
			{
				materials: [],
				mesh: sourceGuid,
				matrix: identity(),
				visibility: [{ kind: 'hideLogicBlock' }],
			},
			{
				materials: [],
				mesh: sourceGuid,
				matrix: identity(),
				visibility: [{ kind: 'hideTrigger' }],
			},
			{
				materials: [],
				mesh: sourceGuid,
				matrix: identity(),
				variant: { index: 0, count: 2 },
			},
			{
				materials: [],
				mesh: sourceGuid,
				matrix: identity(),
				variant: { index: 1, count: 2 },
			},
		]
		await Promise.all([
			writeFile(
				join(bundle, 'manifest.json'),
				JSON.stringify({
					version: 4,
					materials: {},
					paintMaterials: {},
					submeshCounts: { [sourceGuid]: 1 },
					paints: {},
					blocks: {
						0: { name: 'Road', parts: parts.slice(0, 1) },
						98: { name: 'Gameplay', parts },
						1326: { name: 'Invisible road', parts: [] },
					},
				}),
			),
			writeFile(join(bundle, 'meshes', `${sourceGuid}.glb`), triangleGlb()),
			...['axle', 'character', 'soapbox', 'spoiler', 'wheel'].map((name) =>
				writeFile(join(models, `${name}.stl`), triangleStl()),
			),
		])
		await compileProtectedBlockMeshCorpus({
			bundleDirectory: bundle,
			ghostModelDirectory: models,
			outputDirectory: output,
		})
		const index = JSON.parse(
			await readFile(join(output, 'index.json'), 'utf8'),
		) as ProtectedMeshCorpusIndex
		expect(
			index.blocks['98']?.parts.map(({ visibility, variant }) => ({ visibility, variant })),
		).toEqual(parts.map(({ visibility, variant }) => ({ visibility, variant })))
		await MeshoptDecoder.ready
		const block = {
			id: 98,
			position: { x: 0, y: 0, z: 0 },
			rotation: { x: 0, y: 0, z: 0 },
			scale: { x: 1, y: 1, z: 1 },
			attributes: {},
			paints: {},
		}
		const parse = async (
			options: Partial<typeof block> & {
				meshVariant?: number
				hideLogicBlock?: boolean
				hideTrigger?: boolean
			},
		) =>
			parseProtectedLevelMeshBundle(
				await buildProtectedLevelMeshBundle(output, [{ ...block, ...options }]),
			)
		expect((await parse({})).groups[0]?.matrices).toHaveLength(3)
		expect(
			(
				await parse({
					attributes: { 0: 2, 1: -1 },
					hideLogicBlock: true,
					hideTrigger: true,
					meshVariant: 99,
				})
			).groups[0]?.matrices,
		).toHaveLength(2)
		expect(
			(
				await parse({
					attributes: { 0: 0, 1: 1 },
					hideLogicBlock: true,
					hideTrigger: true,
					meshVariant: -3,
				})
			).groups[0]?.matrices,
		).toHaveLength(1)
		for (const id of [0, 1326]) {
			const empty = await parse({ id })
			expect(empty.groups).toEqual([])
			expect(empty.fallbackMatrices).toEqual([])
		}
	})

	it('removes source identifiers and emits only opaque compressed primitive files', async () => {
		const root = await mkdtemp(join(tmpdir(), 'protected-mesh-corpus-'))
		temporaryDirectories.push(root)
		const bundle = join(root, 'bundle')
		const models = join(root, 'models')
		const output = join(root, 'output')
		await Promise.all([mkdir(join(bundle, 'meshes'), { recursive: true }), mkdir(models)])
		await writeFile(
			join(bundle, 'manifest.json'),
			JSON.stringify({
				version: 4,
				materials: {},
				paintMaterials: {},
				submeshCounts: { [sourceGuid]: 1 },
				paints: { 285: [0.75, 0.25, 0.5], 403: [0.25, 0.5, 0.75] },
				blocks: {
					1490: {
						name: 'HW - Fence Straight 1_3d',
						parts: [
							{
								materials: [],
								mesh: sourceGuid,
								name: 'Fence',
								matrix: reflectionX(),
								paint: { index: 0 },
							},
							{
								materials: [],
								mesh: sourceGuid,
								name: 'Hidden',
								matrix: zeroScale(),
							},
						],
					},
				},
			}),
		)
		await writeFile(join(bundle, 'meshes', `${sourceGuid}.glb`), triangleGlb(reflectionX()))
		await Promise.all(
			['axle', 'character', 'soapbox', 'spoiler', 'wheel'].map((name) =>
				writeFile(join(models, `${name}.stl`), triangleStl()),
			),
		)

		const report = await compileProtectedBlockMeshCorpus({
			bundleDirectory: bundle,
			ghostModelDirectory: models,
			outputDirectory: output,
		})
		const index = JSON.parse(
			await readFile(join(output, 'index.json'), 'utf8'),
		) as ProtectedMeshCorpusIndex
		const files = await readdir(join(output, 'meshes'))
		const meshFile = index.blocks['1490']?.parts[0]?.mesh

		expect(report).toMatchObject({
			blockCount: 1,
			meshCount: 1,
			primitiveCount: 1,
			reflectedPrimitiveCount: 1,
			negativeTransformPartCount: 1,
			singularPartCount: 1,
		})
		expect(index.version).toBe(5)
		expect(index.blocks['1490']?.parts).toHaveLength(1)
		expect(meshFile).toMatch(/^[a-f0-9]{32}\.zcp$/)
		expect(files).toContain(meshFile)
		expect(JSON.stringify(index)).not.toContain(sourceGuid)
		expect(JSON.stringify(index)).not.toContain('Fence')
		const payload = await readFile(join(output, 'meshes', meshFile as string))
		expect(payload.subarray(0, 4).toString('ascii')).toBe('ZCMP')
		expect(payload.includes(Buffer.from('glTF'))).toBe(false)

		const [levelBytes, ghostModelBytes] = await Promise.all([
			buildProtectedLevelMeshBundle(output, [
				{
					id: 1490,
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0 },
					scale: { x: 1, y: 1, z: 1 },
					attributes: {},
					paints: { 0: 403 },
				},
			]),
			buildProtectedGhostModelBundle(output),
		])
		await MeshoptDecoder.ready
		const levelBundle = parseProtectedLevelMeshBundle(levelBytes)
		const ghostModels = parseProtectedGhostModelBundle(ghostModelBytes)
		expect(levelBundle.groups).toHaveLength(1)
		expect(levelBundle.groups[0]?.color).toEqual([64 / 255, 128 / 255, 191 / 255])
		expect(levelBundle.groups[0]?.matrices[0]?.determinant()).toBeGreaterThan(0)
		expect(
			Array.from(levelBundle.groups[0]?.primitives[0]?.geometry.getIndex()?.array ?? []),
		).toEqual([0, 1, 2])
		const reflectedPosition =
			levelBundle.groups[0]?.primitives[0]?.geometry.getAttribute('position')
		const reflectedNormal =
			levelBundle.groups[0]?.primitives[0]?.geometry.getAttribute('normal')
		expect(reflectedPosition?.getX(1)).toBeCloseTo(1)
		expect(reflectedNormal?.getZ(1)).toBeCloseTo(1)
		const parityBundle = parseProtectedLevelMeshBundle(
			await buildProtectedLevelMeshBundle(output, [
				{
					id: 1490,
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0 },
					scale: { x: 1, y: 1, z: 1 },
					attributes: {},
					paints: {},
				},
				{
					id: 1490,
					position: { x: 10, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0 },
					scale: { x: -1, y: 1, z: 1 },
					attributes: {},
					paints: {},
				},
			]),
		)
		expect(parityBundle.groups).toHaveLength(2)
		for (const group of parityBundle.groups) {
			expect(group.matrices).toHaveLength(1)
			expect(group.matrices[0]?.determinant()).toBeGreaterThan(0)
		}

		const jitterBlocks = [
			{
				id: 1490,
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 },
				attributes: {},
				paints: { 0: 403 },
			},
			{
				id: 1490,
				position: { x: 10, y: 5, z: 7 },
				rotation: { x: 23, y: 45, z: 12 },
				scale: { x: 2, y: 3, z: 4 },
				attributes: {},
				paints: { 0: 403 },
			},
			{
				id: 1490,
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 },
				attributes: {},
				paints: { 0: 285 },
			},
			{
				id: 1490,
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 },
				attributes: {},
				paints: {},
			},
			{
				id: 1490,
				position: { x: 20, y: 6, z: 9 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: -2, y: 3, z: 4 },
				attributes: {},
				paints: { 0: 403 },
			},
			{
				id: 999_999,
				position: { x: 40, y: 2, z: 3 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 },
				attributes: {},
				paints: {},
			},
		]
		const jitterBytes = await buildProtectedLevelMeshBundle(output, jitterBlocks)
		const repeatedJitterBytes = await buildProtectedLevelMeshBundle(output, jitterBlocks)
		expect(repeatedJitterBytes).toEqual(jitterBytes)
		const jitterBundle = parseProtectedLevelMeshBundle(jitterBytes)
		const colorKey = (color: [number, number, number] | null) =>
			color ? color.map((value) => Math.round(value * 255)).join(',') : 'neutral'
		const tarmacGroups = jitterBundle.groups.filter(
			(group) => colorKey(group.color) === '64,128,191',
		)
		const overrideGroup = jitterBundle.groups.find(
			(group) => colorKey(group.color) === '191,64,128',
		)
		const neutralGroup = jitterBundle.groups.find((group) => group.color === null)
		const sameColorGroup = tarmacGroups.find((group) => group.matrices.length === 2)
		const reflectedGroup = tarmacGroups.find((group) => group.matrices.length === 1)
		const firstMatrix = sameColorGroup?.matrices[0]
		const transformedMatrix = sameColorGroup?.matrices[1]
		const overrideMatrix = overrideGroup?.matrices[0]
		const neutralMatrix = neutralGroup?.matrices[0]
		const reflectedMatrix = reflectedGroup?.matrices[0]
		const fallbackMatrix = jitterBundle.fallbackMatrices[0]
		if (
			!firstMatrix ||
			!transformedMatrix ||
			!overrideMatrix ||
			!neutralMatrix ||
			!reflectedMatrix ||
			!fallbackMatrix
		) {
			throw new Error('Expected deterministic jitter fixture matrices')
		}
		const position = (matrix: THREE.Matrix4) =>
			new THREE.Vector3().setFromMatrixPosition(matrix)
		const firstJitter = position(firstMatrix)
		const transformedJitter = position(transformedMatrix).sub(new THREE.Vector3(10, 5, -7))
		const overrideJitter = position(overrideMatrix)
		const neutralJitter = position(neutralMatrix)
		const reflectedJitter = position(reflectedMatrix).sub(new THREE.Vector3(20, 6, -9))
		expect(firstJitter.length()).toBeCloseTo(0.01, 6)
		expect(transformedJitter.distanceTo(firstJitter)).toBeLessThan(1e-6)
		expect(reflectedJitter.distanceTo(firstJitter)).toBeLessThan(1e-6)
		expect(overrideJitter.length()).toBeCloseTo(0.01, 6)
		expect(overrideJitter.distanceTo(firstJitter)).toBeGreaterThan(0.001)
		expect(neutralJitter.length()).toBeCloseTo(0.01, 6)
		expect(neutralJitter.distanceTo(firstJitter)).toBeGreaterThan(0.001)
		expect(reflectedMatrix.determinant()).toBeGreaterThan(0)
		expect(position(fallbackMatrix).toArray()).toEqual([40, 2, -3])

		expect(ghostModels.body.getAttribute('position').count).toBeGreaterThan(0)
		expect(() => parseProtectedGhostModelBundle(levelBytes)).toThrow(
			'Ghost model bundle contains level geometry',
		)

		clearProtectedMeshCorpusCaches()
		const remoteBaseUrl = 'https://cdn.zeepki.st/blocks/block-meshes-v3'
		const corpusToken = 'test-block-corpus-token'
		const fetchMock = vi.fn(
			async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
				const url = new URL(input instanceof Request ? input.url : input)
				const prefix = '/blocks/block-meshes-v3/'
				if (!url.pathname.startsWith(prefix)) return new Response(null, { status: 404 })
				const value = await readFile(join(output, url.pathname.slice(prefix.length)))
				return new Response(new Uint8Array(value), {
					headers: { 'content-length': String(value.byteLength) },
					status: 200,
				})
			},
		)
		globalThis.fetch = fetchMock as typeof fetch
		const remoteBlock = {
			id: 1490,
			position: { x: 0, y: 0, z: 0 },
			rotation: { x: 0, y: 0, z: 0 },
			scale: { x: 1, y: 1, z: 1 },
			attributes: {},
			paints: { 0: 403 },
		}
		const remoteBlocks = [remoteBlock]
		const [remoteLevelBytes, remoteGhostModelBytes, remoteDigest] = await Promise.all([
			buildProtectedLevelMeshBundle(remoteBaseUrl, remoteBlocks, corpusToken),
			buildProtectedGhostModelBundle(remoteBaseUrl, corpusToken),
			protectedMeshCorpusDigest(remoteBaseUrl, corpusToken),
		])
		expect(parseProtectedLevelMeshBundle(remoteLevelBytes).groups).toHaveLength(1)
		expect(parseProtectedGhostModelBundle(remoteGhostModelBytes).body).toBeDefined()
		expect(remoteDigest).toBe(index.digest)
		expect(fetchMock).toHaveBeenCalled()
		const requestCount = (suffix: string) =>
			fetchMock.mock.calls.filter(([input]) => {
				const url = new URL(input instanceof Request ? input.url : input)
				return url.pathname.endsWith(suffix)
			}).length
		expect(requestCount('/index.json')).toBe(1)
		expect(requestCount(`/meshes/${meshFile}`)).toBe(1)
		for (const [, init] of fetchMock.mock.calls) {
			expect(new Headers(init?.headers).get('referer')).toBe(
				'https://zeepki.st/server/block-corpus/test-block-corpus-token',
			)
			expect(init).toMatchObject({ cache: 'no-store', redirect: 'error' })
		}

		fetchMock.mockClear()
		const sharedMeshBlocks = [
			remoteBlock,
			{
				...remoteBlock,
				position: { x: 10, y: 0, z: 0 },
				paints: { 0: 285 },
			},
		]
		const [firstConcurrentBundle, secondConcurrentBundle] = await Promise.all([
			buildProtectedLevelMeshBundle(remoteBaseUrl, sharedMeshBlocks, corpusToken),
			buildProtectedLevelMeshBundle(remoteBaseUrl, sharedMeshBlocks, corpusToken),
		])
		expect(firstConcurrentBundle).toBe(secondConcurrentBundle)
		expect(requestCount(`/meshes/${meshFile}`)).toBe(1)
		const rebuiltBundle = await buildProtectedLevelMeshBundle(
			remoteBaseUrl,
			sharedMeshBlocks,
			corpusToken,
		)
		expect(rebuiltBundle).not.toBe(firstConcurrentBundle)
		expect(requestCount(`/meshes/${meshFile}`)).toBe(2)
		expect(requestCount('/index.json')).toBe(0)

		fetchMock.mockClear()
		const [firstConcurrentModels, secondConcurrentModels] = await Promise.all([
			buildProtectedGhostModelBundle(remoteBaseUrl, corpusToken),
			buildProtectedGhostModelBundle(remoteBaseUrl, corpusToken),
		])
		expect(firstConcurrentModels).toBe(secondConcurrentModels)
		expect(fetchMock).toHaveBeenCalledTimes(4)
		const rebuiltModels = await buildProtectedGhostModelBundle(remoteBaseUrl, corpusToken)
		expect(rebuiltModels).not.toBe(firstConcurrentModels)
		expect(fetchMock).toHaveBeenCalledTimes(8)

		fetchMock.mockClear()
		fetchMock.mockImplementationOnce(async () => new Response(null, { status: 500 }))
		await expect(
			buildProtectedLevelMeshBundle(remoteBaseUrl, remoteBlocks, corpusToken),
		).rejects.toThrow('Protected mesh corpus returned 500')
		await expect(
			buildProtectedLevelMeshBundle(remoteBaseUrl, remoteBlocks, corpusToken),
		).resolves.toBeInstanceOf(Uint8Array)
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	it('rejects singular GLB node transforms', async () => {
		const root = await mkdtemp(join(tmpdir(), 'protected-mesh-corpus-singular-'))
		temporaryDirectories.push(root)
		const bundle = join(root, 'bundle')
		const models = join(root, 'models')
		await Promise.all([mkdir(join(bundle, 'meshes'), { recursive: true }), mkdir(models)])
		await writeFile(
			join(bundle, 'manifest.json'),
			JSON.stringify({
				version: 4,
				materials: {},
				paintMaterials: {},
				submeshCounts: { [sourceGuid]: 1 },
				paints: {},
				blocks: {
					1: {
						name: 'Singular',
						parts: [
							{
								materials: [],
								mesh: sourceGuid,
								name: 'Singular',
								matrix: identity(),
							},
						],
					},
				},
			}),
		)
		await writeFile(join(bundle, 'meshes', `${sourceGuid}.glb`), triangleGlb(zeroScale()))
		await Promise.all(
			['axle', 'character', 'soapbox', 'spoiler', 'wheel'].map((name) =>
				writeFile(join(models, `${name}.stl`), triangleStl()),
			),
		)

		await expect(
			compileProtectedBlockMeshCorpus({
				bundleDirectory: bundle,
				ghostModelDirectory: models,
				outputDirectory: join(root, 'output'),
			}),
		).rejects.toThrow(`GLB ${sourceGuid}, node 0, primitive 0 contains a singular transform`)
	})

	it.each([2, 3, 4])(
		'rejects a version %s protected corpus index with regeneration guidance',
		async (version) => {
			const root = await mkdtemp(join(tmpdir(), 'protected-mesh-corpus-v2-'))
			temporaryDirectories.push(root)
			await writeFile(
				join(root, 'index.json'),
				JSON.stringify({ version, digest: 'legacy', blocks: {}, paints: {}, common: {} }),
			)
			globalThis.createError = ((input: { statusCode: number; statusMessage: string }) =>
				Object.assign(new Error(input.statusMessage), input)) as typeof createError

			await expect(protectedMeshCorpusDigest(root)).rejects.toMatchObject({
				statusCode: 503,
				statusMessage:
					'Protected mesh corpus version 5 required; regenerate from raw exports',
			})
		},
	)

	it('rejects an older intermediate manifest with regeneration guidance', async () => {
		const root = await mkdtemp(join(tmpdir(), 'protected-mesh-manifest-v2-'))
		temporaryDirectories.push(root)
		await writeFile(
			join(root, 'manifest.json'),
			JSON.stringify({ version: 2, blocks: {}, paints: {} }),
		)
		await expect(
			compileProtectedBlockMeshCorpus({
				bundleDirectory: root,
				ghostModelDirectory: join(root, 'models'),
				outputDirectory: join(root, 'output'),
			}),
		).rejects.toThrow('Block mesh bundle version 4 required; regenerate from raw exports')
	})

	it('rejects a remote corpus without a server token before fetching', async () => {
		const fetchMock = vi.fn()
		globalThis.fetch = fetchMock as typeof fetch
		globalThis.createError = ((input: { statusCode: number; statusMessage: string }) =>
			Object.assign(new Error(input.statusMessage), input)) as typeof createError
		await expect(
			protectedMeshCorpusDigest('https://cdn.zeepki.st/blocks/block-meshes-v3'),
		).rejects.toMatchObject({ statusCode: 503 })
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

function triangleGlb(matrix = identity(), slots = 1) {
	const binary = new Uint8Array(80)
	const positions = new Float32Array(binary.buffer, 0, 9)
	positions.set([0, 0, 0, 1, 0, 0, 0, 1, 0])
	const normals = new Float32Array(binary.buffer, 36, 9)
	normals.set([0, 0, 1, 0, 0, 1, 0, 0, 1])
	new Uint16Array(binary.buffer, 72, 3).set([0, 1, 2])
	const json = {
		asset: { version: '2.0' },
		buffers: [{ byteLength: binary.byteLength }],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: 36 },
			{ buffer: 0, byteOffset: 36, byteLength: 36 },
			{ buffer: 0, byteOffset: 72, byteLength: 6 },
		],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
			{ bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
			{ bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
		],
		meshes: Array.from({ length: slots }, () => ({
			primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
		})),
		nodes: Array.from({ length: slots }, (_, mesh) => ({ matrix, mesh })),
		scenes: [{ nodes: Array.from({ length: slots }, (_, index) => index) }],
		scene: 0,
	}
	const jsonSource = Buffer.from(JSON.stringify(json))
	const jsonLength = Math.ceil(jsonSource.byteLength / 4) * 4
	const result = Buffer.alloc(12 + 8 + jsonLength + 8 + binary.byteLength, 0x20)
	result.writeUInt32LE(0x46546c67, 0)
	result.writeUInt32LE(2, 4)
	result.writeUInt32LE(result.byteLength, 8)
	result.writeUInt32LE(jsonLength, 12)
	result.writeUInt32LE(0x4e4f534a, 16)
	jsonSource.copy(result, 20)
	const binaryHeader = 20 + jsonLength
	result.writeUInt32LE(binary.byteLength, binaryHeader)
	result.writeUInt32LE(0x004e4942, binaryHeader + 4)
	result.set(binary, binaryHeader + 8)
	return result
}

function triangleStl() {
	const result = Buffer.alloc(84 + 50)
	result.writeUInt32LE(1, 80)
	let offset = 84
	for (const value of [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]) {
		result.writeFloatLE(value, offset)
		offset += 4
	}
	return result
}

function identity(): ProtectedMeshMatrix {
	return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

function reflectionX(): ProtectedMeshMatrix {
	return [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

function zeroScale(): ProtectedMeshMatrix {
	return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
}
