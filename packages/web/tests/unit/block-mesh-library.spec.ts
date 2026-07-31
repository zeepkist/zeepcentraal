import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BlockMeshLibrary, type BlockMeshManifest } from '../../app/utils/blockMeshLibrary.client'

const manifest: BlockMeshManifest = {
	version: 1,
	blocks: {
		1490: {
			name: 'HW - Fence Straight 1_3d',
			parts: [
				{
					mesh: 'fence-guid',
					name: 'Fence',
					matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
				},
			],
		},
	},
}

describe('BlockMeshLibrary', () => {
	it('caches manifest and GLB requests while preserving shared geometry matrices', async () => {
		let manifestRequests = 0
		let meshRequests = 0
		const geometry = new THREE.BoxGeometry(1, 1, 1)
		const scene = new THREE.Group()
		const child = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
		child.position.set(2, 3, 4)
		scene.add(child)
		const library = new BlockMeshLibrary({
			baseUrl: 'https://meshes.example.test/',
			fetch: async () => {
				manifestRequests += 1
				return new Response(JSON.stringify(manifest), { status: 200 })
			},
			loader: {
				loadAsync: async () => {
					meshRequests += 1
					return { scene } as never
				},
			},
		})

		expect((await library.getDefinition(1490))?.name).toBe('HW - Fence Straight 1_3d')
		expect(await library.getDefinition(9999)).toBeNull()
		const [first, second] = await Promise.all([
			library.loadMesh('fence-guid'),
			library.loadMesh('fence-guid'),
		])

		expect(manifestRequests).toBe(1)
		expect(meshRequests).toBe(1)
		expect(first).toBe(second)
		expect(first[0]?.geometry).toBe(geometry)
		expect(first[0]?.matrix.elements.slice(12, 15)).toEqual([2, 3, 4])
		library.dispose()
	})

	it('bounds parallel loading and isolates failures', async () => {
		let active = 0
		let maximumActive = 0
		const reportFallback = vi.fn()
		const library = new BlockMeshLibrary({
			baseUrl: '/assets/block-meshes',
			concurrency: 2,
			reportFallback,
			fetch: async () => new Response(JSON.stringify(manifest), { status: 200 }),
			loader: {
				loadAsync: async (url) => {
					active += 1
					maximumActive = Math.max(maximumActive, active)
					await Promise.resolve()
					active -= 1
					if (url.includes('broken')) throw new Error('broken GLB')
					return {
						scene: new THREE.Mesh(
							new THREE.BoxGeometry(),
							new THREE.MeshBasicMaterial(),
						),
					} as never
				},
			},
		})

		const result = await library.loadMeshes(['one', 'two', 'broken', 'three'])

		expect(maximumActive).toBe(2)
		expect([...result.meshes.keys()].sort()).toEqual(['one', 'three', 'two'])
		expect([...result.failed]).toEqual(['broken'])
		expect(reportFallback).toHaveBeenCalledWith({
			kind: 'mesh',
			mesh: 'broken',
			error: expect.any(Error),
		})
		library.dispose()
	})

	it('keeps box rendering available when base URL is empty or manifest fails', async () => {
		const unconfigured = new BlockMeshLibrary({ baseUrl: '' })
		await expect(unconfigured.getManifest()).rejects.toThrow(
			'Block mesh base URL is not configured',
		)

		const unavailable = new BlockMeshLibrary({
			baseUrl: '/assets/block-meshes',
			fetch: async () => new Response('', { status: 503 }),
			reportFallback: vi.fn(),
		})
		await expect(unavailable.getManifest()).rejects.toThrow(
			'Block mesh manifest request failed: 503',
		)
	})
})
