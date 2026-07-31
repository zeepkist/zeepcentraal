import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { GhostLevelBlock } from '../../app/types/ghost'
import type { BlockMeshLibrary, BlockMeshManifest } from '../../app/utils/blockMeshLibrary.client'
import {
	composeBlockPartMatrix,
	createGhostLevelBlockMatrix,
	createGhostLevelFallbackMatrix,
	GhostLevelMeshRenderer,
} from '../../app/utils/ghostLevelMeshRenderer.client'

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const

const manifest: BlockMeshManifest = {
	version: 1,
	blocks: {
		1490: {
			name: 'HW - Fence Straight 1_3d',
			parts: [{ mesh: 'fence-guid', name: 'Fence', matrix: [...identity] }],
		},
	},
}

describe('GhostLevelMeshRenderer', () => {
	it('replaces known boxes with one instanced GLB group and keeps unknown fallback boxes', async () => {
		const geometry = new THREE.BoxGeometry()
		const library = fakeLibrary({
			getManifest: vi.fn(async () => manifest),
			loadMeshes: vi.fn(async () => ({
				meshes: new Map([
					[
						'fence-guid',
						[{ geometry, matrix: new THREE.Matrix4().makeTranslation(0, 2, 0) }],
					],
				]),
				failed: new Set<string>(),
			})),
		})
		const scene = new THREE.Scene()
		const renderer = new GhostLevelMeshRenderer(scene, { baseUrl: '', library }, '#a8a29e')

		await renderer.render([block(1490, 0), block(1490, 10), block(9999, 20)], vector())

		const group = scene.getObjectByName('level-geometry') as THREE.Group
		const meshes = group.children.filter(
			(child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
		)
		expect(meshes).toHaveLength(2)
		expect(meshes.map(({ count }) => count).sort()).toEqual([1, 2])
		expect(library.loadMeshes).toHaveBeenCalledOnce()
		renderer.dispose()
	})

	it('composes level, prefab, and GLB child matrices in render order', () => {
		const blockMatrix = createGhostLevelBlockMatrix(block(1490, 10), vector())
		const partMatrix = new THREE.Matrix4().makeTranslation(2, 0, 0)
		const composed = composeBlockPartMatrix(blockMatrix, partMatrix, {
			geometry: new THREE.BoxGeometry(),
			matrix: new THREE.Matrix4().makeTranslation(0, 3, 0),
		})
		const position = new THREE.Vector3().setFromMatrixPosition(composed)

		expect(position.x).toBeCloseTo(8)
		expect(position.y).toBeCloseTo(3)
		expect(position.z).toBeCloseTo(0)
	})

	it('retains existing box fallback scaling for zero and mirrored scales', () => {
		const fallback = createGhostLevelFallbackMatrix(
			{ ...block(9999, 0), scale: { x: 0, y: -1, z: 40 } },
			vector(),
		)
		const scale = new THREE.Vector3()
		fallback.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale)

		expect(scale.toArray()).toEqual([0.2, 2, 64])
	})

	it('ignores stale async mesh results after level change', async () => {
		let resolveManifest: ((value: BlockMeshManifest) => void) | undefined
		const manifestPromise = new Promise<BlockMeshManifest>((resolve) => {
			resolveManifest = resolve
		})
		const library = fakeLibrary({
			getManifest: vi.fn(() => manifestPromise),
			loadMeshes: vi.fn(async () => ({ meshes: new Map(), failed: new Set<string>() })),
		})
		const scene = new THREE.Scene()
		const renderer = new GhostLevelMeshRenderer(scene, { baseUrl: '', library }, '#a8a29e')

		const staleRender = renderer.render([block(1490, 0)], vector())
		const currentRender = renderer.render([block(9999, 5)], vector())
		resolveManifest?.(manifest)
		await Promise.all([staleRender, currentRender])

		const group = scene.getObjectByName('level-geometry') as THREE.Group
		const fallback = group.children[0] as THREE.InstancedMesh
		expect(fallback).toBeInstanceOf(THREE.InstancedMesh)
		expect(fallback.count).toBe(1)
		expect(library.loadMeshes).toHaveBeenCalledOnce()
		renderer.dispose()
	})
})

function fakeLibrary(overrides: Partial<BlockMeshLibrary>) {
	return {
		dispose: vi.fn(),
		...overrides,
	} as unknown as BlockMeshLibrary
}

function block(id: number, x: number): GhostLevelBlock {
	return {
		id,
		position: { x, y: 0, z: 0 },
		rotation: vector(),
		scale: { x: 1, y: 1, z: 1 },
	}
}

function vector() {
	return { x: 0, y: 0, z: 0 }
}
