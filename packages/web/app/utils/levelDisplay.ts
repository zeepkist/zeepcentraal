export const LEVEL_HASH_DISPLAY_LENGTH = 10

export function getLevelDisplayName(name: string | null | undefined, xxHash: string): string {
	return name ?? xxHash.slice(0, LEVEL_HASH_DISPLAY_LENGTH)
}
