import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { GhostLevelBlock } from '../../app/types/ghost'
import {
	composeProtectedMeshMatrix,
	GhostLevelMeshRenderer,
} from '../../app/utils/ghostLevelMeshRenderer.client'
import type {
	ProtectedLevelMeshBundle,
	ProtectedMeshLibrary,
} from '../../app/utils/protectedMeshLibrary.client'

describe('GhostLevelMeshRenderer', () => {
	it('stays empty while loading then renders protected geometry and server-selected fallbacks', async () => {
		const geometry = new THREE.BoxGeometry()
		const bundle = fakeBundle(geometry)
		let resolveBundle: ((bundle: ProtectedLevelMeshBundle) => void) | undefined
		const library = fakeLibrary(
			new Promise((resolve) => {
				resolveBundle = resolve
			}),
		)
		const scene = new THREE.Scene()
		const renderer = new GhostLevelMeshRenderer(scene, { library }, '#a8a29e')

		const rendering = renderer.render(
			42,
			[block(1490, 0), block(1490, 10), block(9999, 20)],
			vector(),
		)
		expect(scene.getObjectByName('level-geometry')).toBeUndefined()
		resolveBundle?.(bundle)
		await rendering

		const group = scene.getObjectByName('level-geometry') as THREE.Group
		const meshes = group.children.filter(
			(child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
		)
		expect(meshes).toHaveLength(2)
		expect(meshes.map(({ count }) => count).sort()).toEqual([1, 2])
		expect(library.load).toHaveBeenCalledWith(42)
		for (const mesh of meshes) {
			const material = mesh.material as THREE.MeshStandardMaterial
			expect(material.transparent).toBe(false)
			expect(material.opacity).toBe(1)
		}
		renderer.dispose()
	})

	it('composes origin, server instance, and primitive matrices in render order', () => {
		const composed = composeProtectedMeshMatrix(
			new THREE.Matrix4().makeTranslation(-10, 0, 0),
			new THREE.Matrix4().makeTranslation(12, 0, 0),
			{
				geometry: new THREE.BoxGeometry(),
				matrix: new THREE.Matrix4().makeTranslation(0, 3, 0),
			},
		)
		const position = new THREE.Vector3().setFromMatrixPosition(composed)
		expect(position.toArray()).toEqual([2, 3, 0])
	})

	it('leaves terrain empty when protected bundle loading fails', async () => {
		const scene = new THREE.Scene()
		const renderer = new GhostLevelMeshRenderer(
			scene,
			{ library: fakeLibrary(Promise.reject(new Error('Authentication required'))) },
			'#a8a29e',
		)

		await renderer.render(42, [block(1490, 0)], vector())

		expect(scene.getObjectByName('level-geometry')).toBeUndefined()
		renderer.dispose()
	})

	it('ignores stale bundle results after level change or clear', async () => {
		let resolveBundle: ((bundle: ProtectedLevelMeshBundle) => void) | undefined
		const pending = new Promise<ProtectedLevelMeshBundle>((resolve) => {
			resolveBundle = resolve
		})
		const library = fakeLibrary(pending)
		const scene = new THREE.Scene()
		const renderer = new GhostLevelMeshRenderer(scene, { library }, '#a8a29e')
		const stale = renderer.render(1, [block(1490, 0)], vector())
		renderer.clear()
		resolveBundle?.(fakeBundle(new THREE.BoxGeometry()))
		await stale
		expect(scene.getObjectByName('level-geometry')).toBeUndefined()
		renderer.dispose()
	})
})

function fakeBundle(geometry: THREE.BufferGeometry): ProtectedLevelMeshBundle {
	return {
		groups: [
			{
				primitives: [{ geometry, matrix: new THREE.Matrix4().makeTranslation(0, 2, 0) }],
				matrices: [
					new THREE.Matrix4().makeTranslation(0, 0, 0),
					new THREE.Matrix4().makeTranslation(10, 0, 0),
				],
			},
		],
		fallbackMatrices: [new THREE.Matrix4().makeTranslation(20, 0, 0)],
	}
}

function fakeLibrary(bundle: Promise<ProtectedLevelMeshBundle>) {
	return { load: vi.fn(() => bundle) } as unknown as ProtectedMeshLibrary
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
