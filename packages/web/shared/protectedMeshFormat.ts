import type { GhostEnvironment, ProtectedLightDefinition } from './ghostLighting'

export const PROTECTED_MESH_CORPUS_VERSION = 6
export const PROTECTED_MESH_BUNDLE_VERSION = 5
export const PROTECTED_GHOST_MODEL_BUNDLE_VERSION = 3
export const PROTECTED_MESH_PRIMITIVE_VERSION = 1

export const PROTECTED_MESH_BUNDLE_MAGIC = 0x424d435a
export const PROTECTED_MESH_PRIMITIVE_MAGIC = 0x504d435a

export const PROTECTED_MESH_GROUP_FLAGS = {
	hasColor: 1 << 0,
	reflectX: 1 << 1,
} as const

export const GHOST_MODEL_SLOTS = {
	body: 1,
	axles: 2,
	character: 3,
	wheel: 4,
} as const

export type GhostModelSlot = (typeof GHOST_MODEL_SLOTS)[keyof typeof GHOST_MODEL_SLOTS]

export type ProtectedMeshMatrix = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
]

export type ProtectedMeshColor = [number, number, number]

// Colours are authored sRGB. Convert once when creating Three materials.
export type ProtectedMeshMaterial = {
	color: ProtectedMeshColor
	opacity: number
	roughness: number
	metalness: number
	specular: ProtectedMeshColor
	workflow: 'metallic' | 'specular'
	transparent: boolean
	doubleSided: boolean
	/** Authored emission, linear HDR. Absent in legacy corpora. */
	emissive?: ProtectedMeshColor
}

export type ProtectedMeshMaterialSlot = { material: string | null; paintIndex?: number }

export function validateProtectedMeshMaterial(value: ProtectedMeshMaterial) {
	if (
		!value ||
		!Array.isArray(value.color) ||
		value.color.length !== 3 ||
		!Array.isArray(value.specular) ||
		value.specular.length !== 3 ||
		![...value.color, ...value.specular, value.opacity, value.roughness, value.metalness].every(
			(number) => Number.isFinite(number) && number >= 0 && number <= 1,
		) ||
		!['metallic', 'specular'].includes(value.workflow) ||
		typeof value.transparent !== 'boolean' ||
		typeof value.doubleSided !== 'boolean' ||
		(value.emissive !== undefined &&
			(!Array.isArray(value.emissive) ||
				value.emissive.length !== 3 ||
				!value.emissive.every(
					(number) => Number.isFinite(number) && number >= 0 && number <= 65_504,
				)))
	)
		throw new Error('Malformed protected material descriptor')
	return value
}

export type ProtectedMeshVisibility =
	| { kind: 'attribute'; index: number }
	| { kind: 'hideLogicBlock' | 'hideTrigger' }

export type ProtectedMeshPart = {
	mesh: string
	matrix: ProtectedMeshMatrix
	visibility?: ProtectedMeshVisibility[]
	variant?: { index: number; count: number }
	paint?: { index: number; defaultId?: number }
	materials: ProtectedMeshMaterialSlot[]
}

export type ProtectedMeshCorpusIndex = {
	version: 5 | 6
	digest: string
	blocks: Record<
		string,
		{
			optionMode?: 0 | 1 | 2
			parts: ProtectedMeshPart[]
			lights?: ProtectedLightDefinition[]
		}
	>
	paints: Record<string, ProtectedMeshColor>
	materials: Record<string, ProtectedMeshMaterial>
	paintMaterials: Record<string, string>
	primitiveSlots: Record<string, number[]>
	common: Record<'axles' | 'body' | 'character' | 'wheel', string>
	skyProfiles?: Record<string, GhostEnvironment>
}
