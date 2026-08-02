export const PROTECTED_MESH_CORPUS_VERSION = 2
export const PROTECTED_MESH_BUNDLE_VERSION = 2
export const PROTECTED_MESH_PRIMITIVE_VERSION = 1

export const PROTECTED_MESH_BUNDLE_MAGIC = 0x424d435a
export const PROTECTED_MESH_PRIMITIVE_MAGIC = 0x504d435a

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

export type ProtectedMeshPart = {
	mesh: string
	matrix: ProtectedMeshMatrix
	attribute?: { index: number; defaultVisible: boolean }
	paint?: { index: number; defaultId?: number }
}

export type ProtectedMeshCorpusIndex = {
	version: 2
	digest: string
	blocks: Record<
		string,
		{
			optionMode?: 0 | 1 | 2
			parts: ProtectedMeshPart[]
		}
	>
	paints: Record<string, ProtectedMeshColor>
	common: Record<'axles' | 'body' | 'character' | 'wheel', string>
}
