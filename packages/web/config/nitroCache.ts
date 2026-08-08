export const NITRO_CACHE_MAX_SIZE = 67_108_864
export const NITRO_CACHE_MAX_ENTRY_SIZE = 4_194_304
export const NITRO_CACHE_TTL = 259_200_000

export function createNitroCacheStorageOptions(
	limits: { maxSize: number; maxEntrySize: number; ttl: number } = {
		maxSize: NITRO_CACHE_MAX_SIZE,
		maxEntrySize: NITRO_CACHE_MAX_ENTRY_SIZE,
		ttl: NITRO_CACHE_TTL,
	},
) {
	return {
		driver: 'lruCache' as const,
		...limits,
	}
}
