import * as THREE from 'three'
import {
	GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR,
	GHOST_SOAPBOX_SCALE,
	GHOST_SOAPBOX_WHEEL_LAYOUT,
	GHOST_WHEEL_COLORS,
	isGhostWheelPresent,
} from '~/utils/ghostSoapbox'
import type { GhostSoapboxGeometries } from '~/utils/protectedMeshLibrary.client'

type GhostOpacityTier = 'regular' | 'world-record'

export type GhostMeshDescriptor = {
	recordId: number
	bodyColor: string
	isWorldRecord: boolean
}

export type GhostMeshFrameState = {
	worldMatrix: THREE.Matrix4
	position: THREE.Vector3
	ragdoll: boolean
	ragdollMatrix: THREE.Matrix4 | null
	braking: boolean
	paraglider: boolean
	wheelState: number | undefined
	wheelColor: number
}

type GhostSlot = {
	globalIndex: number
	tier: GhostOpacityTier
	tierIndex: number
}

type TierModelPool = {
	capacity: number
	count: number
	body: THREE.InstancedMesh
	axles: THREE.InstancedMesh
	character: THREE.InstancedMesh
	wheels: THREE.InstancedMesh
	ragdoll: THREE.InstancedMesh
	wheelColors: number[]
	bounds: THREE.Box3
	sphere: THREE.Sphere
}

type TierFallbackPool = {
	capacity: number
	count: number
	marker: THREE.InstancedMesh
	bounds: THREE.Box3
	sphere: THREE.Sphere
}

type GlobalModelPool = {
	capacity: number
	count: number
	brakes: THREE.InstancedMesh
	paragliders: THREE.InstancedMesh
	bounds: THREE.Box3
	sphere: THREE.Sphere
}

const TIER_OPACITY = {
	regular: {
		model: 0.76,
		marker: 0.78,
	},
	'world-record': {
		model: 0.92,
		marker: 0.95,
	},
} as const

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0)
const FALLBACK_LOCAL_MATRIX = new THREE.Matrix4().makeTranslation(0, 0.55, 0)
const PARAGLIDER_LOCAL_MATRIX = new THREE.Matrix4().compose(
	new THREE.Vector3(0, 3.8, 0),
	new THREE.Quaternion(),
	new THREE.Vector3(1, 0.35, 1),
)
const BRAKE_LOCAL_MATRICES = [-1, 1].map((side) =>
	new THREE.Matrix4().makeTranslation(side * 0.48, -0.12, -2.96),
)
const WHEEL_LOCAL_MATRICES = GHOST_SOAPBOX_WHEEL_LAYOUT.map(({ position, mirror }) =>
	new THREE.Matrix4().compose(
		new THREE.Vector3(...position),
		new THREE.Quaternion(),
		new THREE.Vector3(mirror ? -1 : 1, 1, 1),
	),
)
const MODEL_BOUNDING_RADIUS = 4
const EFFECT_BOUNDING_RADIUS = 5
const FALLBACK_BOUNDING_RADIUS = 0.7

export class GhostMeshBatchRenderer {
	private readonly slots = new Map<number, GhostSlot>()
	private readonly fallbackGeometry = new THREE.SphereGeometry(0.55, 8, 6)
	private readonly brakeGeometry = new THREE.BoxGeometry(0.28, 0.16, 0.08)
	private readonly paragliderGeometry = new THREE.SphereGeometry(
		2.2,
		16,
		8,
		0,
		Math.PI * 2,
		0,
		Math.PI / 2,
	)
	private readonly ragdollGeometry = new THREE.CapsuleGeometry(0.35, 1.1, 5, 8)
	private readonly tierModelPools = new Map<GhostOpacityTier, TierModelPool>()
	private readonly tierFallbackPools = new Map<GhostOpacityTier, TierFallbackPool>()
	private readonly descriptorColors = new Map<number, THREE.Color>()
	private readonly tierDescriptors: Record<GhostOpacityTier, GhostMeshDescriptor[]> = {
		regular: [],
		'world-record': [],
	}
	private readonly scratchMatrix = new THREE.Matrix4()
	private readonly scratchModelMatrix = new THREE.Matrix4()
	private readonly modelRootMatrix = createModelRootMatrix(0)
	private geometries: GhostSoapboxGeometries | null = null
	private globalModelPool: GlobalModelPool | null = null
	private descriptors: GhostMeshDescriptor[] = []

	constructor(private readonly scene: THREE.Scene) {}

	configure(descriptors: readonly GhostMeshDescriptor[]) {
		this.descriptors = [...descriptors]
		this.slots.clear()
		this.descriptorColors.clear()
		this.tierDescriptors.regular.length = 0
		this.tierDescriptors['world-record'].length = 0
		const tierCounts: Record<GhostOpacityTier, number> = {
			regular: 0,
			'world-record': 0,
		}

		for (const [globalIndex, descriptor] of this.descriptors.entries()) {
			const tier = descriptor.isWorldRecord ? 'world-record' : 'regular'
			const tierIndex = tierCounts[tier]++
			this.tierDescriptors[tier].push(descriptor)
			this.slots.set(descriptor.recordId, { globalIndex, tier, tierIndex })
			this.descriptorColors.set(descriptor.recordId, new THREE.Color(descriptor.bodyColor))
		}

		for (const tier of ['regular', 'world-record'] as const) {
			const count = tierCounts[tier]
			const fallback = this.ensureFallbackPool(tier, count)
			this.configureFallbackPool(fallback, tier, count)
			if (this.geometries) {
				const model = this.ensureModelPool(tier, count)
				this.configureModelPool(model, tier, count)
			}
		}
		if (this.geometries) {
			const global = this.ensureGlobalModelPool(this.descriptors.length)
			this.configureGlobalModelPool(global, this.descriptors.length)
		}
		this.updateModeVisibility()
	}

	setModelGeometries(geometries: GhostSoapboxGeometries) {
		this.geometries = geometries
		if (!geometries.wheel.boundingBox) geometries.wheel.computeBoundingBox()
		const wheelHeight = geometries.wheel.boundingBox?.getSize(new THREE.Vector3()).y ?? 0
		this.modelRootMatrix.copy(createModelRootMatrix(wheelHeight))
		this.configure(this.descriptors)
	}

	beginFrame() {
		for (const pool of this.tierModelPools.values()) pool.bounds.makeEmpty()
		for (const pool of this.tierFallbackPools.values()) pool.bounds.makeEmpty()
		this.globalModelPool?.bounds.makeEmpty()
	}

	update(recordId: number, state: GhostMeshFrameState) {
		const slot = this.slots.get(recordId)
		if (!slot) return
		if (!this.geometries) {
			const pool = this.tierFallbackPools.get(slot.tier)
			if (!pool) return
			this.scratchMatrix.multiplyMatrices(state.worldMatrix, FALLBACK_LOCAL_MATRIX)
			pool.marker.setMatrixAt(slot.tierIndex, this.scratchMatrix)
			pool.bounds.expandByPoint(state.position)
			return
		}

		const tierPool = this.tierModelPools.get(slot.tier)
		const globalPool = this.globalModelPool
		if (!tierPool || !globalPool) return
		this.scratchModelMatrix.multiplyMatrices(state.worldMatrix, this.modelRootMatrix)
		const modelMatrix = state.ragdoll ? HIDDEN_MATRIX : this.scratchModelMatrix
		tierPool.body.setMatrixAt(slot.tierIndex, modelMatrix)
		tierPool.axles.setMatrixAt(slot.tierIndex, modelMatrix)
		tierPool.character.setMatrixAt(slot.tierIndex, modelMatrix)
		tierPool.ragdoll.setMatrixAt(
			slot.tierIndex,
			state.ragdoll ? (state.ragdollMatrix ?? state.worldMatrix) : HIDDEN_MATRIX,
		)

		const wheelOffset = slot.tierIndex * 4
		for (const [wheelIndex, localMatrix] of WHEEL_LOCAL_MATRICES.entries()) {
			const visible = !state.ragdoll && isGhostWheelPresent(state.wheelState, wheelIndex)
			if (visible) this.scratchMatrix.multiplyMatrices(this.scratchModelMatrix, localMatrix)
			tierPool.wheels.setMatrixAt(
				wheelOffset + wheelIndex,
				visible ? this.scratchMatrix : HIDDEN_MATRIX,
			)
		}
		if (tierPool.wheelColors[slot.tierIndex] !== state.wheelColor) {
			const color = new THREE.Color(state.wheelColor)
			for (let wheelIndex = 0; wheelIndex < 4; wheelIndex += 1) {
				tierPool.wheels.setColorAt(wheelOffset + wheelIndex, color)
			}
			tierPool.wheelColors[slot.tierIndex] = state.wheelColor
			if (tierPool.wheels.instanceColor) tierPool.wheels.instanceColor.needsUpdate = true
		}

		const brakeOffset = slot.globalIndex * 2
		for (const [brakeIndex, localMatrix] of BRAKE_LOCAL_MATRICES.entries()) {
			const visible = !state.ragdoll && state.braking
			if (visible) this.scratchMatrix.multiplyMatrices(this.scratchModelMatrix, localMatrix)
			globalPool.brakes.setMatrixAt(
				brakeOffset + brakeIndex,
				visible ? this.scratchMatrix : HIDDEN_MATRIX,
			)
		}
		if (!state.ragdoll && state.paraglider) {
			this.scratchMatrix.multiplyMatrices(state.worldMatrix, PARAGLIDER_LOCAL_MATRIX)
			globalPool.paragliders.setMatrixAt(slot.globalIndex, this.scratchMatrix)
		} else globalPool.paragliders.setMatrixAt(slot.globalIndex, HIDDEN_MATRIX)

		tierPool.bounds.expandByPoint(state.position)
		globalPool.bounds.expandByPoint(state.position)
	}

	hide(recordId: number) {
		const slot = this.slots.get(recordId)
		if (!slot) return
		const fallback = this.tierFallbackPools.get(slot.tier)
		fallback?.marker.setMatrixAt(slot.tierIndex, HIDDEN_MATRIX)
		const model = this.tierModelPools.get(slot.tier)
		if (!model) return
		for (const mesh of [model.body, model.axles, model.character, model.ragdoll]) {
			mesh.setMatrixAt(slot.tierIndex, HIDDEN_MATRIX)
		}
		for (let index = 0; index < 4; index += 1) {
			model.wheels.setMatrixAt(slot.tierIndex * 4 + index, HIDDEN_MATRIX)
		}
		const global = this.globalModelPool
		if (!global) return
		global.paragliders.setMatrixAt(slot.globalIndex, HIDDEN_MATRIX)
		for (let index = 0; index < 2; index += 1) {
			global.brakes.setMatrixAt(slot.globalIndex * 2 + index, HIDDEN_MATRIX)
		}
	}

	commitFrame() {
		if (!this.geometries) {
			for (const pool of this.tierFallbackPools.values()) {
				pool.marker.instanceMatrix.needsUpdate = true
				updateBounds([pool.marker], pool.bounds, pool.sphere, FALLBACK_BOUNDING_RADIUS)
			}
			return
		}
		for (const pool of this.tierModelPools.values()) {
			const meshes = [pool.body, pool.axles, pool.character, pool.wheels, pool.ragdoll]
			for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true
			updateBounds(meshes, pool.bounds, pool.sphere, MODEL_BOUNDING_RADIUS)
		}
		if (this.globalModelPool) {
			const meshes = [this.globalModelPool.brakes, this.globalModelPool.paragliders]
			for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true
			updateBounds(
				meshes,
				this.globalModelPool.bounds,
				this.globalModelPool.sphere,
				EFFECT_BOUNDING_RADIUS,
			)
		}
	}

	getStats() {
		const modelMeshCount =
			[...this.tierModelPools.values()].reduce(
				(total, pool) => total + (pool.count > 0 ? 5 : 0),
				0,
			) + (this.globalModelPool && this.globalModelPool.count > 0 ? 2 : 0)
		const fallbackMeshCount = [...this.tierFallbackPools.values()].filter(
			(pool) => pool.count > 0,
		).length
		return {
			mode: this.geometries ? 'model' : 'fallback',
			ghostCount: this.descriptors.length,
			modelMeshCount,
			fallbackMeshCount,
		} as const
	}

	dispose() {
		for (const pool of this.tierModelPools.values()) {
			this.disposeMeshes([pool.body, pool.axles, pool.character, pool.wheels, pool.ragdoll])
		}
		for (const pool of this.tierFallbackPools.values()) this.disposeMeshes([pool.marker])
		if (this.globalModelPool) {
			this.disposeMeshes([this.globalModelPool.brakes, this.globalModelPool.paragliders])
		}
		this.fallbackGeometry.dispose()
		this.brakeGeometry.dispose()
		this.paragliderGeometry.dispose()
		this.ragdollGeometry.dispose()
		this.tierModelPools.clear()
		this.tierFallbackPools.clear()
		this.slots.clear()
		this.globalModelPool = null
	}

	private ensureModelPool(tier: GhostOpacityTier, count: number) {
		const current = this.tierModelPools.get(tier)
		if (current && current.capacity >= count) return current
		if (current) {
			this.disposeMeshes([
				current.body,
				current.axles,
				current.character,
				current.wheels,
				current.ragdoll,
			])
		}
		const capacity = nextCapacity(count)
		const opacity = TIER_OPACITY[tier].model
		const geometries = this.geometries
		if (!geometries) throw new Error('Ghost model geometries are not loaded')
		const pool: TierModelPool = {
			capacity,
			count: 0,
			body: this.createMesh(
				`ghost-model-${tier}-body`,
				geometries.body,
				createStandardMaterial(opacity, 0.42, 0.18),
				capacity,
			),
			axles: this.createMesh(
				`ghost-model-${tier}-axles`,
				geometries.axles,
				createStandardMaterial(opacity, 0.5, 0.65, 0x4b5563),
				capacity,
			),
			character: this.createMesh(
				`ghost-model-${tier}-character`,
				geometries.character,
				createStandardMaterial(opacity, 0.68, 0.04),
				capacity,
			),
			wheels: this.createMesh(
				`ghost-model-${tier}-wheels`,
				geometries.wheel,
				createStandardMaterial(opacity, 0.82, 0.08),
				capacity * 4,
			),
			ragdoll: this.createMesh(
				`ghost-model-${tier}-ragdolls`,
				this.ragdollGeometry,
				createStandardMaterial(opacity, 0.68, 0.04),
				capacity,
			),
			wheelColors: Array.from({ length: capacity }, () => GHOST_WHEEL_COLORS.standard),
			bounds: new THREE.Box3(),
			sphere: new THREE.Sphere(),
		}
		this.tierModelPools.set(tier, pool)
		return pool
	}

	private ensureFallbackPool(tier: GhostOpacityTier, count: number) {
		const current = this.tierFallbackPools.get(tier)
		if (current && current.capacity >= count) return current
		if (current) this.disposeMeshes([current.marker])
		const capacity = nextCapacity(count)
		const pool: TierFallbackPool = {
			capacity,
			count: 0,
			marker: this.createMesh(
				`ghost-fallback-${tier}`,
				this.fallbackGeometry,
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: true,
					opacity: TIER_OPACITY[tier].marker,
				}),
				capacity,
			),
			bounds: new THREE.Box3(),
			sphere: new THREE.Sphere(),
		}
		this.tierFallbackPools.set(tier, pool)
		return pool
	}

	private ensureGlobalModelPool(count: number) {
		const current = this.globalModelPool
		if (current && current.capacity >= count) return current
		if (current) this.disposeMeshes([current.brakes, current.paragliders])
		const capacity = nextCapacity(count)
		const pool: GlobalModelPool = {
			capacity,
			count: 0,
			brakes: this.createMesh(
				'ghost-model-brakes',
				this.brakeGeometry,
				new THREE.MeshBasicMaterial({ color: 0xef4444 }),
				capacity * 2,
			),
			paragliders: this.createMesh(
				'ghost-model-paragliders',
				this.paragliderGeometry,
				new THREE.MeshStandardMaterial({
					color: 0xffffff,
					transparent: true,
					opacity: 0.72,
					side: THREE.DoubleSide,
				}),
				capacity,
			),
			bounds: new THREE.Box3(),
			sphere: new THREE.Sphere(),
		}
		this.globalModelPool = pool
		return pool
	}

	private configureModelPool(pool: TierModelPool, tier: GhostOpacityTier, count: number) {
		pool.count = count
		pool.body.count = count
		pool.axles.count = count
		pool.character.count = count
		pool.ragdoll.count = count
		pool.wheels.count = count * 4
		pool.wheelColors.fill(GHOST_WHEEL_COLORS.standard, 0, count)
		for (let index = 0; index < count; index += 1) {
			const descriptor = this.tierDescriptors[tier][index]
			if (!descriptor) continue
			const bodyColor = this.descriptorColors.get(descriptor.recordId) ?? new THREE.Color()
			pool.body.setColorAt(index, bodyColor)
			pool.character.setColorAt(
				index,
				bodyColor.clone().lerp(new THREE.Color(0xffffff), 0.32),
			)
			pool.ragdoll.setColorAt(index, bodyColor)
			for (let wheelIndex = 0; wheelIndex < 4; wheelIndex += 1) {
				pool.wheels.setColorAt(
					index * 4 + wheelIndex,
					new THREE.Color(GHOST_WHEEL_COLORS.standard),
				)
			}
		}
		initializeHidden([pool.body, pool.axles, pool.character, pool.wheels, pool.ragdoll])
		markColorsDirty([pool.body, pool.character, pool.wheels, pool.ragdoll])
	}

	private configureFallbackPool(pool: TierFallbackPool, tier: GhostOpacityTier, count: number) {
		pool.count = count
		pool.marker.count = count
		for (let index = 0; index < count; index += 1) {
			const descriptor = this.tierDescriptors[tier][index]
			if (!descriptor) continue
			pool.marker.setColorAt(
				index,
				this.descriptorColors.get(descriptor.recordId) ?? new THREE.Color(),
			)
		}
		initializeHidden([pool.marker])
		markColorsDirty([pool.marker])
	}

	private configureGlobalModelPool(pool: GlobalModelPool, count: number) {
		pool.count = count
		pool.brakes.count = count * 2
		pool.paragliders.count = count
		for (const [index, descriptor] of this.descriptors.entries()) {
			pool.paragliders.setColorAt(
				index,
				this.descriptorColors.get(descriptor.recordId) ?? new THREE.Color(),
			)
		}
		initializeHidden([pool.brakes, pool.paragliders])
		markColorsDirty([pool.paragliders])
	}

	private createMesh(
		name: string,
		geometry: THREE.BufferGeometry,
		material: THREE.Material,
		capacity: number,
	) {
		const mesh = new THREE.InstancedMesh(geometry, material, capacity)
		mesh.name = name
		mesh.count = 0
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
		mesh.frustumCulled = true
		this.scene.add(mesh)
		return mesh
	}

	private updateModeVisibility() {
		const modelVisible = this.geometries !== null
		for (const pool of this.tierModelPools.values()) {
			for (const mesh of [pool.body, pool.axles, pool.character, pool.wheels, pool.ragdoll]) {
				mesh.visible = modelVisible
			}
		}
		for (const pool of this.tierFallbackPools.values()) pool.marker.visible = !modelVisible
		if (this.globalModelPool) {
			this.globalModelPool.brakes.visible = modelVisible
			this.globalModelPool.paragliders.visible = modelVisible
		}
	}

	private disposeMeshes(meshes: THREE.InstancedMesh[]) {
		for (const mesh of meshes) {
			this.scene.remove(mesh)
			mesh.dispose()
			const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
			for (const material of materials) material.dispose()
		}
	}
}

function nextCapacity(count: number) {
	let capacity = 1
	while (capacity < count) capacity *= 2
	return capacity
}

function createModelRootMatrix(wheelHeight: number) {
	const groundLift = wheelHeight * GHOST_SOAPBOX_SCALE * GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR
	return new THREE.Matrix4().compose(
		new THREE.Vector3(0, groundLift, 0),
		new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
		new THREE.Vector3(GHOST_SOAPBOX_SCALE, GHOST_SOAPBOX_SCALE, GHOST_SOAPBOX_SCALE),
	)
}

function createStandardMaterial(
	opacity: number,
	roughness: number,
	metalness: number,
	color = 0xffffff,
) {
	return new THREE.MeshStandardMaterial({
		color,
		transparent: opacity < 1,
		opacity,
		roughness,
		metalness,
	})
}

function initializeHidden(meshes: THREE.InstancedMesh[]) {
	for (const mesh of meshes) {
		for (let index = 0; index < mesh.count; index += 1) mesh.setMatrixAt(index, HIDDEN_MATRIX)
		mesh.instanceMatrix.needsUpdate = true
	}
}

function markColorsDirty(meshes: THREE.InstancedMesh[]) {
	for (const mesh of meshes) {
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
	}
}

function updateBounds(
	meshes: THREE.InstancedMesh[],
	bounds: THREE.Box3,
	sphere: THREE.Sphere,
	padding: number,
) {
	if (bounds.isEmpty()) {
		sphere.center.set(0, 0, 0)
		sphere.radius = 0
	} else {
		bounds.getBoundingSphere(sphere)
		sphere.radius += padding
	}
	for (const mesh of meshes) mesh.boundingSphere = sphere
}
