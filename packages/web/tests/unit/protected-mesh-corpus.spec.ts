import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MeshoptDecoder } from 'meshoptimizer/decoder'
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
	it('resolves toggle and exclusive attributes with prefab defaults', () => {
		const parts = [
			{ mesh: 'uncontrolled', matrix: identity() },
			{
				mesh: 'small',
				matrix: identity(),
				attribute: { index: 0, defaultVisible: true },
			},
			{
				mesh: 'large',
				matrix: identity(),
				attribute: { index: 1, defaultVisible: false },
			},
		]
		const selected = (optionMode: 0 | 1 | 2, attributes: Record<number, number>) =>
			selectProtectedMeshParts({ optionMode, parts }, attributes).map(({ mesh }) => mesh)

		expect(selected(2, {})).toEqual(['uncontrolled', 'small'])
		expect(selected(2, { 1: 1 })).toEqual(['uncontrolled', 'large'])
		expect(selected(2, { 0: 1, 1: 1 })).toEqual(['uncontrolled', 'small'])
		expect(selected(0, { 7: 1 })).toEqual(['uncontrolled', 'small'])
		expect(selected(1, { 0: 0 })).toEqual(['uncontrolled'])
	})

	it('includes attributes and paints in protected bundle cache identity', () => {
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
				version: 2,
				paints: { 403: [0.25, 0.5, 0.75] },
				blocks: {
					1490: {
						name: 'HW - Fence Straight 1_3d',
						parts: [
							{
								mesh: sourceGuid,
								name: 'Fence',
								matrix: identity(),
								paint: { index: 0 },
							},
						],
					},
				},
			}),
		)
		await writeFile(join(bundle, 'meshes', `${sourceGuid}.glb`), triangleGlb())
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

		expect(report).toMatchObject({ blockCount: 1, meshCount: 1, primitiveCount: 1 })
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
		expect(ghostModels.body.getAttribute('position').count).toBeGreaterThan(0)
		expect(() => parseProtectedGhostModelBundle(levelBytes)).toThrow(
			'Ghost model bundle contains level geometry',
		)

		clearProtectedMeshCorpusCaches()
		const remoteBaseUrl = 'https://cdn.zeepki.st/blocks/block-meshes-v2'
		const corpusToken = 'test-block-corpus-token'
		const fetchMock = vi.fn(
			async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
				const url = new URL(input instanceof Request ? input.url : input)
				const prefix = '/blocks/block-meshes-v2/'
				if (!url.pathname.startsWith(prefix)) return new Response(null, { status: 404 })
				const value = await readFile(join(output, url.pathname.slice(prefix.length)))
				return new Response(new Uint8Array(value), {
					headers: { 'content-length': String(value.byteLength) },
					status: 200,
				})
			},
		)
		globalThis.fetch = fetchMock as typeof fetch
		const remoteBlocks = [
			{
				id: 1490,
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 },
				attributes: {},
				paints: { 0: 403 },
			},
		]
		const [remoteLevelBytes, remoteGhostModelBytes, remoteDigest] = await Promise.all([
			buildProtectedLevelMeshBundle(remoteBaseUrl, remoteBlocks, corpusToken),
			buildProtectedGhostModelBundle(remoteBaseUrl, corpusToken),
			protectedMeshCorpusDigest(remoteBaseUrl, corpusToken),
		])
		expect(parseProtectedLevelMeshBundle(remoteLevelBytes).groups).toHaveLength(1)
		expect(parseProtectedGhostModelBundle(remoteGhostModelBytes).body).toBeDefined()
		expect(remoteDigest).toBe(index.digest)
		expect(fetchMock).toHaveBeenCalled()
		for (const [, init] of fetchMock.mock.calls) {
			expect(new Headers(init?.headers).get('referer')).toBe(
				'https://zeepki.st/server/block-corpus/test-block-corpus-token',
			)
			expect(init).toMatchObject({ cache: 'no-store', redirect: 'error' })
		}
	})

	it('rejects a remote corpus without a server token before fetching', async () => {
		const fetchMock = vi.fn()
		globalThis.fetch = fetchMock as typeof fetch
		globalThis.createError = ((input: { statusCode: number; statusMessage: string }) =>
			Object.assign(new Error(input.statusMessage), input)) as typeof createError
		await expect(
			protectedMeshCorpusDigest('https://cdn.zeepki.st/blocks/block-meshes-v2'),
		).rejects.toMatchObject({ statusCode: 503 })
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

function triangleGlb() {
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
		meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
		nodes: [{ mesh: 0 }],
		scenes: [{ nodes: [0] }],
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
