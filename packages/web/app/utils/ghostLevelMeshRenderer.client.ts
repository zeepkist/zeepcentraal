import * as THREE from 'three'
import type { GhostLevelBlock, GhostVector3 } from '../types/ghost'
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
}

export class GhostLevelMeshRenderer {
	private readonly fallbackGeometry = new THREE.BoxGeometry(2, 2, 2)
	private readonly material: THREE.MeshStandardMaterial
	private readonly paintedMaterials = new Map<string, THREE.MeshStandardMaterial>()
	private group: THREE.Group | null = null
	private revision = 0
	private disposed = false

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

	render(levelId: number, blocks: readonly GhostLevelBlock[], origin: GhostVector3) {
		const revision = ++this.revision
		this.replaceGroup(null)
		if (blocks.length === 0) return Promise.resolve()
		return this.renderLoaded(levelId, origin, revision)
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
	}

	private async renderLoaded(levelId: number, origin: GhostVector3, revision: number) {
		let bundle: ProtectedLevelMeshBundle
		try {
			bundle = await this.options.library.load(levelId)
		} catch {
			return
		}
		if (this.isStale(revision)) return
		const originMatrix = createOriginMatrix(origin)
		const batches: MeshBatch[] = []
		for (const group of bundle.groups) {
			const material = this.materialForColor(group.color)
			for (const primitive of group.primitives) {
				batches.push({
					geometry: primitive.geometry,
					material,
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
				batch.material,
				batch.matrices.length,
			)
			for (const [index, matrix] of batch.matrices.entries()) mesh.setMatrixAt(index, matrix)
			mesh.instanceMatrix.needsUpdate = true
			mesh.computeBoundingSphere()
			mesh.matrixAutoUpdate = false
			mesh.updateMatrix()
			group.add(mesh)
		}
		const fallback = this.createFallbackMeshFromMatrices(bundle.fallbackMatrices, originMatrix)
		if (fallback) group.add(fallback)
		group.matrixAutoUpdate = false
		group.updateMatrix()
		this.replaceGroup(group)
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
		return mesh
	}

	private replaceGroup(group: THREE.Group | null) {
		if (this.group) {
			this.scene.remove(this.group)
			this.group.traverse((object) => {
				if (object instanceof THREE.InstancedMesh) object.dispose()
			})
		}
		this.group = group
		if (group) this.scene.add(group)
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
