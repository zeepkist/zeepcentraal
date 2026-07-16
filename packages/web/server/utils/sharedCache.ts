import { cache } from '@zeepkist/core'

export const WEB_EXTERNAL_CACHE_TTL = 15 * 60 * 1_000

export async function getSharedCached<T>(key: string, load: () => Promise<T>): Promise<T> {
	const cached = cache.get(key) as T | Promise<T> | undefined
	if (cached !== undefined) return cached

	const pending = load()
	cache.set(key, pending, { ttl: WEB_EXTERNAL_CACHE_TTL })

	try {
		const value = await pending
		cache.set(key, value, { ttl: WEB_EXTERNAL_CACHE_TTL })
		return value
	} catch (error) {
		if (cache.get(key) === pending) cache.delete(key)
		throw error
	}
}
