export const PROTECTED_MESH_CORPUS_VERSION = 1
export const PROTECTED_MESH_BUNDLE_VERSION = 1
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

export type ProtectedMeshCorpusIndex = {
	version: 1
	digest: string
	blocks: Record<
		string,
		{
			parts: Array<{ mesh: string; matrix: ProtectedMeshMatrix }>
		}
	>
	common: Record<'axles' | 'body' | 'character' | 'wheel', string>
}
