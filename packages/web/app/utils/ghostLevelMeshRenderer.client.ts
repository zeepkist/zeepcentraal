import * as THREE from 'three'
import type { GhostLevelBlock, GhostVector3 } from '../types/ghost'
import {
	type BlockMeshDefinition,
	BlockMeshLibrary,
	type BlockMeshManifest,
	type LoadedBlockMeshPrimitive,
} from './blockMeshLibrary.client'
import { rebaseGhostPosition } from './ghostScene'

export type GhostLevelMeshRendererOptions = {
	baseUrl: string
	concurrency?: number
	library?: BlockMeshLibrary
}

type MeshBatch = {
	geometry: THREE.BufferGeometry
	matrices: THREE.Matrix4[]
}

const ASSET_RIPPER_TO_GHOST_MATRIX = new THREE.Matrix4().makeRotationY(Math.PI)

export class GhostLevelMeshRenderer {
	private readonly library: BlockMeshLibrary
	private readonly fallbackGeometry = new THREE.BoxGeometry(2, 2, 2)
	private readonly material: THREE.MeshStandardMaterial
	private readonly enabled: boolean
	private group: THREE.Group | null = null
	private revision = 0
	private disposed = false

	constructor(
		private readonly scene: THREE.Scene,
		options: GhostLevelMeshRendererOptions,
		color: THREE.ColorRepresentation,
	) {
		this.enabled = Boolean(options.library || options.baseUrl.trim())
		this.library =
			options.library ??
			new BlockMeshLibrary({ baseUrl: options.baseUrl, concurrency: options.concurrency })
		this.material = new THREE.MeshStandardMaterial({
			color,
			transparent: false,
			opacity: 1,
			roughness: 0.85,
			metalness: 0.05,
		})
	}

	render(blocks: readonly GhostLevelBlock[], origin: GhostVector3) {
		const revision = ++this.revision
		this.replaceGroup(this.createFallbackGroup(blocks, origin))
		if (!this.enabled || blocks.length === 0) return Promise.resolve()
		return this.renderLoaded(blocks, origin, revision)
	}

	clear() {
		this.revision += 1
		this.replaceGroup(null)
	}

	dispose() {
		this.disposed = true
		this.clear()
		this.library.dispose()
		this.fallbackGeometry.dispose()
		this.material.dispose()
	}

	private async renderLoaded(
		blocks: readonly GhostLevelBlock[],
		origin: GhostVector3,
		revision: number,
	) {
		let manifest: BlockMeshManifest
		try {
			manifest = await this.library.getManifest()
		} catch {
			return
		}
		if (this.isStale(revision)) return
		const definitions = new Map<number, BlockMeshDefinition>()
		const requiredMeshes = new Set<string>()
		for (const block of blocks) {
			if (block.id === null) continue
			const definition = manifest.blocks[String(block.id)]
			if (!definition || definition.parts.length === 0) continue
			definitions.set(block.id, definition)
			for (const part of definition.parts) requiredMeshes.add(part.mesh)
		}
		const loaded = await this.library.loadMeshes(requiredMeshes)
		if (this.isStale(revision)) return

		const batches = new Map<string, MeshBatch>()
		const fallbackBlocks: GhostLevelBlock[] = []
		for (const block of blocks) {
			const definition = block.id === null ? undefined : definitions.get(block.id)
			if (!definition || definition.parts.some(({ mesh }) => !loaded.meshes.has(mesh))) {
				fallbackBlocks.push(block)
				continue
			}
			const blockMatrix = createGhostLevelBlockMatrix(block, origin)
			for (const part of definition.parts) {
				const primitives = loaded.meshes.get(part.mesh)
				if (!primitives) continue
				const partMatrix = new THREE.Matrix4().fromArray(part.matrix)
				for (const [primitiveIndex, primitive] of primitives.entries()) {
					const key = `${part.mesh}:${primitiveIndex}`
					const batch = batches.get(key) ?? {
						geometry: primitive.geometry,
						matrices: [],
					}
					batch.matrices.push(composeBlockPartMatrix(blockMatrix, partMatrix, primitive))
					batches.set(key, batch)
				}
			}
		}

		const group = new THREE.Group()
		group.name = 'level-geometry'
		for (const batch of batches.values()) {
			const mesh = new THREE.InstancedMesh(
				batch.geometry,
				this.material,
				batch.matrices.length,
			)
			for (const [index, matrix] of batch.matrices.entries()) mesh.setMatrixAt(index, matrix)
			mesh.instanceMatrix.needsUpdate = true
			mesh.computeBoundingSphere()
			group.add(mesh)
		}
		const fallback = this.createFallbackMesh(fallbackBlocks, origin)
		if (fallback) group.add(fallback)
		this.replaceGroup(group)
	}

	private createFallbackGroup(blocks: readonly GhostLevelBlock[], origin: GhostVector3) {
		if (blocks.length === 0) return null
		const group = new THREE.Group()
		group.name = 'level-geometry'
		const mesh = this.createFallbackMesh(blocks, origin)
		if (mesh) group.add(mesh)
		return group
	}

	private createFallbackMesh(blocks: readonly GhostLevelBlock[], origin: GhostVector3) {
		if (blocks.length === 0) return null
		const mesh = new THREE.InstancedMesh(this.fallbackGeometry, this.material, blocks.length)
		for (const [index, block] of blocks.entries()) {
			mesh.setMatrixAt(index, createGhostLevelFallbackMatrix(block, origin))
		}
		mesh.instanceMatrix.needsUpdate = true
		mesh.computeBoundingSphere()
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

	private isStale(revision: number) {
		return this.disposed || revision !== this.revision
	}
}

export function createGhostLevelBlockMatrix(block: GhostLevelBlock, origin: GhostVector3) {
	return createGhostLevelTransformMatrix(block, origin, clampMeshScale)
}

export function createGhostLevelFallbackMatrix(block: GhostLevelBlock, origin: GhostVector3) {
	return createGhostLevelTransformMatrix(block, origin, clampFallbackScale)
}

function createGhostLevelTransformMatrix(
	block: GhostLevelBlock,
	origin: GhostVector3,
	mapScale: (value: number) => number,
) {
	const position = rebaseGhostPosition(block.position, origin)
	const euler = new THREE.Euler(
		THREE.MathUtils.degToRad(-block.rotation.x),
		THREE.MathUtils.degToRad(-block.rotation.y),
		THREE.MathUtils.degToRad(block.rotation.z),
		'YXZ',
	)
	return new THREE.Matrix4().compose(
		new THREE.Vector3(position.x, position.y, position.z),
		new THREE.Quaternion().setFromEuler(euler),
		new THREE.Vector3(
			mapScale(block.scale.x),
			mapScale(block.scale.y),
			mapScale(block.scale.z),
		),
	)
}

export function composeBlockPartMatrix(
	blockMatrix: THREE.Matrix4,
	partMatrix: THREE.Matrix4,
	primitive: LoadedBlockMeshPrimitive,
) {
	return blockMatrix
		.clone()
		.multiply(ASSET_RIPPER_TO_GHOST_MATRIX)
		.multiply(partMatrix)
		.multiply(primitive.matrix)
}

function clampMeshScale(value: number) {
	const sign = value < 0 ? -1 : 1
	return sign * Math.min(64, Math.max(0.001, Math.abs(value)))
}

function clampFallbackScale(value: number) {
	return Math.min(64, Math.max(0.2, Math.abs(value) * 2))
}
