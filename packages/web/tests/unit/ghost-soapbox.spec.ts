import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
	GhostMeshBatchRenderer,
	type GhostMeshDescriptor,
} from '../../app/utils/ghostMeshBatch.client'
import {
	GHOST_SOAPBOX_AXLE_POSITIONS,
	GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR,
	GHOST_SOAPBOX_SCALE,
	GHOST_SOAPBOX_WHEEL_LAYOUT,
	GHOST_WHEEL_COLORS,
	isGhostWheelPresent,
	resolveGhostWheelColor,
} from '../../app/utils/ghostSoapbox'

const viewer = readFileSync(
	new URL('../../app/components/record/GhostPlaybackViewer.client.vue', import.meta.url),
	'utf8',
)
const corpusGenerator = readFileSync(
	new URL('../../scripts/protectedBlockMeshCorpus.ts', import.meta.url),
	'utf8',
)
const batch = readFileSync(
	new URL('../../app/utils/ghostMeshBatch.client.ts', import.meta.url),
	'utf8',
)

function geometries() {
	return {
		axles: new THREE.BoxGeometry(1, 1, 1),
		body: new THREE.BoxGeometry(1, 1, 1),
		character: new THREE.BoxGeometry(1, 1, 1),
		wheel: new THREE.BoxGeometry(1, 1, 1),
	}
}

function descriptors(count: number): GhostMeshDescriptor[] {
	return Array.from({ length: count }, (_, index) => ({
		recordId: index + 1,
		bodyColor: index % 2 === 0 ? '#38bdf8' : '#f472b6',
		isWorldRecord: index === 0,
	}))
}

function mesh(scene: THREE.Scene, name: string) {
	const found = scene.getObjectByName(name)
	expect(found).toBeInstanceOf(THREE.InstancedMesh)
	return found as THREE.InstancedMesh
}

function frameState(overrides: Partial<Parameters<GhostMeshBatchRenderer['update']>[1]> = {}) {
	return {
		worldMatrix: new THREE.Matrix4(),
		position: new THREE.Vector3(),
		ragdoll: false,
		ragdollMatrix: null,
		braking: false,
		paraglider: false,
		wheelState: 0b1111,
		wheelColor: GHOST_WHEEL_COLORS.standard,
		...overrides,
	}
}

describe('ghost soapbox model', () => {
	it('moves every independently rendered model part into protected corpus generation', () => {
		for (const name of ['axle', 'character', 'soapbox', 'spoiler', 'wheel']) {
			expect(corpusGenerator).toContain(`'${name}'`)
		}
		expect(corpusGenerator).toContain('mergePrimitives')
		expect(viewer).toContain('ProtectedMeshLibrary')
		expect(viewer).not.toContain('.stl')
		expect(GHOST_SOAPBOX_AXLE_POSITIONS).toHaveLength(2)
		expect(GHOST_SOAPBOX_WHEEL_LAYOUT).toHaveLength(4)
	})

	it('scales and raises the detailed model by 0.75 rendered wheel heights', () => {
		expect(GHOST_SOAPBOX_SCALE).toBe(0.5)
		expect(GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR).toBe(0.75)
		expect(batch).toContain('GHOST_SOAPBOX_SCALE')
		expect(batch).toContain('Math.PI')

		const scene = new THREE.Scene()
		const renderer = new GhostMeshBatchRenderer(scene)
		const shared = geometries()
		renderer.configure(descriptors(1))
		renderer.setModelGeometries(shared)
		renderer.beginFrame()
		renderer.update(1, frameState())
		renderer.commitFrame()

		const matrix = new THREE.Matrix4()
		mesh(scene, 'ghost-model-world-record-body').getMatrixAt(0, matrix)
		const position = new THREE.Vector3()
		const rotation = new THREE.Quaternion()
		const scale = new THREE.Vector3()
		matrix.decompose(position, rotation, scale)
		expect(position.x).toBe(0)
		expect(position.y).toBeCloseTo(GHOST_SOAPBOX_SCALE * GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR)
		expect(position.z).toBe(0)
		expect(scale.x).toBeCloseTo(GHOST_SOAPBOX_SCALE)
		expect(scale.y).toBeCloseTo(GHOST_SOAPBOX_SCALE)
		expect(scale.z).toBeCloseTo(GHOST_SOAPBOX_SCALE)
		const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation)
		expect(forward.z).toBeCloseTo(-1)
		mesh(scene, 'ghost-model-world-record-wheels').getMatrixAt(0, matrix)
		expect(new THREE.Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(
			GHOST_SOAPBOX_SCALE *
				(GHOST_SOAPBOX_WHEEL_LAYOUT[0].position[1] +
					GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR),
		)
		renderer.dispose()
	})

	it('instances full models for 200 ghosts with bounded mesh count and shared geometry', () => {
		const scene = new THREE.Scene()
		const renderer = new GhostMeshBatchRenderer(scene)
		const shared = geometries()
		renderer.configure(descriptors(200))
		expect(renderer.getStats()).toMatchObject({
			mode: 'fallback',
			ghostCount: 200,
			fallbackMeshCount: 2,
		})
		renderer.setModelGeometries(shared)
		expect(renderer.getStats()).toEqual({
			mode: 'model',
			ghostCount: 200,
			modelMeshCount: 12,
			fallbackMeshCount: 2,
		})
		expect(mesh(scene, 'ghost-model-regular-body').count).toBe(199)
		expect(mesh(scene, 'ghost-model-world-record-body').count).toBe(1)
		expect(mesh(scene, 'ghost-model-regular-wheels').count).toBe(199 * 4)
		expect(mesh(scene, 'ghost-model-regular-body').geometry).toBe(shared.body)
		expect(mesh(scene, 'ghost-model-world-record-body').geometry).toBe(shared.body)
		renderer.dispose()
	})

	it('reuses pool meshes across reconciliations that fit current capacity', () => {
		const scene = new THREE.Scene()
		const renderer = new GhostMeshBatchRenderer(scene)
		renderer.configure(descriptors(100))
		renderer.setModelGeometries(geometries())
		const body = mesh(scene, 'ghost-model-regular-body')
		renderer.configure(descriptors(50))
		expect(mesh(scene, 'ghost-model-regular-body')).toBe(body)
		renderer.dispose()
	})

	it('uses wheel existence bits and per-instance modifier colours', () => {
		expect([0, 1, 2, 3].map((index) => isGhostWheelPresent(0b0101, index))).toEqual([
			true,
			false,
			true,
			false,
		])
		expect(isGhostWheelPresent(undefined, 0)).toBe(true)
		expect(viewer).not.toContain('frame.groundedWheelState &')

		const scene = new THREE.Scene()
		const renderer = new GhostMeshBatchRenderer(scene)
		renderer.configure(descriptors(2))
		renderer.setModelGeometries(geometries())
		renderer.beginFrame()
		renderer.update(
			2,
			frameState({
				wheelState: 0b0101,
				wheelColor: GHOST_WHEEL_COLORS.soap,
			}),
		)
		renderer.commitFrame()
		const wheels = mesh(scene, 'ghost-model-regular-wheels')
		const matrix = new THREE.Matrix4()
		wheels.getMatrixAt(0, matrix)
		expect(matrix.determinant()).not.toBe(0)
		wheels.getMatrixAt(1, matrix)
		expect(matrix.determinant()).toBe(0)
		const color = new THREE.Color()
		wheels.getColorAt(0, color)
		expect(color.getHex()).toBe(GHOST_WHEEL_COLORS.soap)
		renderer.dispose()
	})

	it('colours standard, offroad, and soap wheels distinctly', () => {
		expect(resolveGhostWheelColor({})).toBe(GHOST_WHEEL_COLORS.standard)
		expect(resolveGhostWheelColor({ offroad: true })).toBe(GHOST_WHEEL_COLORS.offroad)
		expect(resolveGhostWheelColor({ soap: true })).toBe(GHOST_WHEEL_COLORS.soap)
		expect(resolveGhostWheelColor({ soap: true, offroad: true })).toBe(GHOST_WHEEL_COLORS.soap)
		expect(GHOST_WHEEL_COLORS.offroad).not.toBe(GHOST_WHEEL_COLORS.soap)
	})

	it('keeps instanced fallback spheres and instanced generic paraglider geometry', () => {
		const scene = new THREE.Scene()
		const renderer = new GhostMeshBatchRenderer(scene)
		renderer.configure(descriptors(25))
		expect(mesh(scene, 'ghost-fallback-regular').visible).toBe(true)
		renderer.beginFrame()
		for (const descriptor of descriptors(25)) {
			renderer.update(
				descriptor.recordId,
				frameState({ position: new THREE.Vector3(descriptor.recordId, 0, 0) }),
			)
		}
		renderer.commitFrame()
		expect(mesh(scene, 'ghost-fallback-regular').frustumCulled).toBe(true)
		expect(mesh(scene, 'ghost-fallback-regular').boundingSphere?.radius).toBeGreaterThan(0)

		renderer.setModelGeometries(geometries())
		expect(mesh(scene, 'ghost-fallback-regular').visible).toBe(false)
		expect(mesh(scene, 'ghost-model-paragliders')).toBeDefined()
		expect(batch).toContain('new THREE.SphereGeometry(')
		renderer.dispose()
	})
})
