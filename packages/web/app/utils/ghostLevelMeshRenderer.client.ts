import * as THREE from 'three'
import type { GhostLightingData } from '../../shared/ghostLighting'
import type { ProtectedMeshMaterial } from '../../shared/protectedMeshFormat'
import type { GhostLevelBlock, GhostVector3 } from '../types/ghost'
import {
	createGhostNativeMaterial,
	sortTransparentGhostInstances,
} from './ghostNativeMaterial.client'
import type {
	ProtectedLevelMeshBundle,
	ProtectedMeshLibrary,
	ProtectedMeshPrimitive,
} from './protectedMeshLibrary.client'

export type GhostLevelMeshRendererOptions = {
	library: ProtectedMeshLibrary
}

type MeshBatch = {
	geometry: THREE.BufferGeometry
	matrices: THREE.Matrix4[]
	material: THREE.MeshStandardMaterial
	nativeMaterial: THREE.MeshStandardMaterial
	nativeOnly: boolean
}

export class GhostLevelMeshRenderer {
	private readonly fallbackGeometry = new THREE.BoxGeometry(2, 2, 2)
	private readonly material: THREE.MeshStandardMaterial
	private readonly paintedMaterials = new Map<string, THREE.MeshStandardMaterial>()
	private readonly nativeMaterials = new Map<string, THREE.MeshPhysicalMaterial>()
	private readonly bindings: Array<{
		mesh: THREE.InstancedMesh
		matrices: THREE.Matrix4[]
		physics: THREE.MeshStandardMaterial
		native: THREE.MeshStandardMaterial
		nativeOnly: boolean
	}> = []
	private paintMode: 'physics' | 'material' = 'physics'
	private group: THREE.Group | null = null
	private fallbackMesh: THREE.InstancedMesh | null = null
	private revision = 0
	private disposed = false
	private lighting: GhostLightingData | undefined
	private readonly bounds = new THREE.Box3()

	getLighting() {
		return this.lighting
	}
	getBounds() {
		return this.bounds
	}

	constructor(
		private readonly scene: THREE.Scene,
		private readonly options: GhostLevelMeshRendererOptions,
		color: THREE.ColorRepresentation,
	) {
		this.material = new THREE.MeshStandardMaterial({
			color,
			transparent: false,
			opacity: 1,
			roughness: 0.85,
			metalness: 0.05,
		})
	}

	render(
		levelId: number,
		blocks: readonly GhostLevelBlock[],
		origin: GhostVector3,
		assetUrl?: string,
	) {
		const revision = ++this.revision
		this.replaceGroup(null)
		if (blocks.length === 0) return Promise.resolve()
		return this.renderLoaded(levelId, origin, revision, assetUrl)
	}

	setPaintMode(mode: 'physics' | 'material') {
		this.paintMode = mode
		if (this.fallbackMesh) {
			this.fallbackMesh.castShadow = mode === 'material'
			this.fallbackMesh.receiveShadow = mode === 'material'
		}
		for (const binding of this.bindings) {
			binding.mesh.material = mode === 'material' ? binding.native : binding.physics
			binding.mesh.visible = !binding.nativeOnly || mode === 'material'
			binding.mesh.castShadow = mode === 'material' && !binding.native.transparent
			binding.mesh.receiveShadow = mode === 'material'
		}
	}

	prepare(camera: THREE.Camera) {
		if (this.paintMode !== 'material') return
		camera.updateMatrixWorld()
		for (const binding of this.bindings)
			if (binding.native.transparent)
				sortTransparentGhostInstances(binding.mesh, binding.matrices, camera)
	}

	clear() {
		this.revision += 1
		this.replaceGroup(null)
	}

	dispose() {
		this.disposed = true
		this.clear()
		this.fallbackGeometry.dispose()
		this.material.dispose()
		for (const material of this.paintedMaterials.values()) material.dispose()
		this.paintedMaterials.clear()
		for (const material of this.nativeMaterials.values()) material.dispose()
		this.nativeMaterials.clear()
	}

	private async renderLoaded(
		levelId: number,
		origin: GhostVector3,
		revision: number,
		assetUrl?: string,
	) {
		let bundle: ProtectedLevelMeshBundle
		try {
			bundle = await (assetUrl
				? this.options.library.load(levelId, assetUrl)
				: this.options.library.load(levelId))
		} catch {
			return
		}
		if (this.isStale(revision)) return
		this.lighting = bundle.lighting
		const originMatrix = createOriginMatrix(origin)
		const batches: MeshBatch[] = []
		for (const group of bundle.groups) {
			const material = this.materialForColor(group.color)
			for (const [index, primitive] of group.primitives.entries()) {
				batches.push({
					geometry: primitive.geometry,
					material,
					nativeMaterial: this.materialForDescriptor(group.materials[index] ?? null),
					nativeOnly: primitive.nativeOnly === true,
					matrices: group.matrices.map((matrix) =>
						composeProtectedMeshMatrix(originMatrix, matrix, primitive),
					),
				})
			}
		}
		const group = new THREE.Group()
		group.name = 'level-geometry'
		for (const batch of batches) {
			const mesh = new THREE.InstancedMesh(
				batch.geometry,
				this.paintMode === 'material' ? batch.nativeMaterial : batch.material,
				batch.matrices.length,
			)
			for (const [index, matrix] of batch.matrices.entries()) mesh.setMatrixAt(index, matrix)
			mesh.instanceMatrix.needsUpdate = true
			mesh.computeBoundingSphere()
			mesh.matrixAutoUpdate = false
			mesh.updateMatrix()
			mesh.onBeforeRender = (_renderer, _scene, camera) => {
				if (mesh.material instanceof THREE.Material && mesh.material.transparent)
					sortTransparentGhostInstances(mesh, batch.matrices, camera)
			}
			mesh.visible = !batch.nativeOnly || this.paintMode === 'material'
			mesh.userData.reflectionSource = true
			mesh.userData.lightingGeometry = true
			mesh.castShadow = this.paintMode === 'material' && !batch.nativeMaterial.transparent
			mesh.receiveShadow = this.paintMode === 'material'
			this.bindings.push({
				mesh,
				matrices: batch.matrices,
				physics: batch.material,
				native: batch.nativeMaterial,
				nativeOnly: batch.nativeOnly,
			})
			group.add(mesh)
		}
		const fallback = this.createFallbackMeshFromMatrices(bundle.fallbackMatrices, originMatrix)
		if (fallback) group.add(fallback)
		group.matrixAutoUpdate = false
		group.updateMatrix()
		this.replaceGroup(group)
		this.bounds.setFromObject(group)
	}

	private createFallbackMeshFromMatrices(matrices: THREE.Matrix4[], originMatrix: THREE.Matrix4) {
		if (matrices.length === 0) return null
		const mesh = new THREE.InstancedMesh(this.fallbackGeometry, this.material, matrices.length)
		for (const [index, matrix] of matrices.entries()) {
			mesh.setMatrixAt(index, originMatrix.clone().multiply(matrix))
		}
		mesh.instanceMatrix.needsUpdate = true
		mesh.computeBoundingSphere()
		mesh.matrixAutoUpdate = false
		mesh.updateMatrix()
		mesh.userData.reflectionSource = true
		mesh.userData.lightingGeometry = true
		mesh.castShadow = this.paintMode === 'material'
		mesh.receiveShadow = this.paintMode === 'material'
		this.fallbackMesh = mesh
		return mesh
	}

	private replaceGroup(group: THREE.Group | null) {
		if (!group) {
			this.fallbackMesh = null
			this.lighting = undefined
			this.bounds.makeEmpty()
		}
		if (this.group) {
			this.scene.remove(this.group)
			this.group.traverse((object) => {
				if (object instanceof THREE.InstancedMesh) object.dispose()
			})
		}
		for (let index = this.bindings.length - 1; index >= 0; index -= 1) {
			if (this.bindings[index]?.mesh.parent !== group) this.bindings.splice(index, 1)
		}
		this.group = group
		if (group) this.scene.add(group)
	}

	private materialForDescriptor(descriptor: ProtectedMeshMaterial | null) {
		if (!descriptor) return this.material
		const key = JSON.stringify(descriptor)
		let material = this.nativeMaterials.get(key)
		if (!material) {
			material = createGhostNativeMaterial(descriptor)
			this.nativeMaterials.set(key, material)
		}
		return material
	}

	private materialForColor(color: [number, number, number] | null) {
		if (!color) return this.material
		const key = color.map((value) => Math.round(value * 255)).join(',')
		let material = this.paintedMaterials.get(key)
		if (!material) {
			material = new THREE.MeshStandardMaterial({
				color: new THREE.Color().setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace),
				transparent: false,
				opacity: 1,
				roughness: 0.85,
				metalness: 0.05,
			})
			this.paintedMaterials.set(key, material)
		}
		return material
	}

	private isStale(revision: number) {
		return this.disposed || revision !== this.revision
	}
}

export function composeProtectedMeshMatrix(
	originMatrix: THREE.Matrix4,
	instanceMatrix: THREE.Matrix4,
	primitive: ProtectedMeshPrimitive,
) {
	return originMatrix.clone().multiply(instanceMatrix).multiply(primitive.matrix)
}

function createOriginMatrix(origin: GhostVector3) {
	return new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, origin.z)
}
