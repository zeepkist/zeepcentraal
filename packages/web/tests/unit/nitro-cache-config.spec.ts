import { createStorage } from 'unstorage'
import lruCacheDriver from 'unstorage/drivers/lru-cache'
import { describe, expect, it } from 'vitest'
import {
	createNitroCacheStorageOptions,
	NITRO_CACHE_MAX_ENTRY_SIZE,
	NITRO_CACHE_MAX_SIZE,
	NITRO_CACHE_TTL,
} from '../../config/nitroCache'

describe('Nitro cache storage', () => {
	it('propagates production byte and lifetime limits', () => {
		expect(createNitroCacheStorageOptions()).toEqual({
			driver: 'lruCache',
			maxSize: NITRO_CACHE_MAX_SIZE,
			maxEntrySize: NITRO_CACHE_MAX_ENTRY_SIZE,
			ttl: NITRO_CACHE_TTL,
		})
		expect(NITRO_CACHE_MAX_SIZE).toBe(67_108_864)
		expect(NITRO_CACHE_MAX_ENTRY_SIZE).toBe(4_194_304)
		expect(NITRO_CACHE_TTL).toBe(259_200_000)
	})

	it('evicts least-recent entries and rejects oversized entries', async () => {
		const { driver: _driver, ...options } = createNitroCacheStorageOptions({
			maxSize: 16,
			maxEntrySize: 12,
			ttl: 60_000,
		})
		const storage = createStorage({ driver: lruCacheDriver(options) })

		await storage.setItem('a', '123456')
		await storage.setItem('b', '123456')
		await storage.setItem('c', '123456')

		expect(await storage.hasItem('a')).toBe(false)
		expect(await storage.hasItem('b')).toBe(true)
		expect(await storage.hasItem('c')).toBe(true)

		await storage.setItem('x', '123456789012')
		expect(await storage.hasItem('x')).toBe(false)
	})
})
