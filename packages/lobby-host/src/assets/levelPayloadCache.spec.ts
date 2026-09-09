import { expect, mock, test } from 'bun:test'
import { LevelPayloadCache } from './levelPayloadCache'

test('deduplicates in-flight payload loads and evicts after final release', async () => {
	const cache = new LevelPayloadCache()
	const load = mock(async () => Uint8Array.of(1, 2, 3))
	const [first, second] = await Promise.all([
		cache.acquire('hash', load),
		cache.acquire('hash', load),
	])
	expect(load).toHaveBeenCalledTimes(1)
	expect(first.data).toBe(second.data)
	expect(cache.size).toBe(1)
	first.release()
	expect(cache.size).toBe(1)
	second.release()
	expect(cache.size).toBe(0)
	second.release()
	expect(cache.size).toBe(0)
})

test('removes failed in-flight load', async () => {
	const cache = new LevelPayloadCache()
	await expect(
		cache.acquire('hash', async () => Promise.reject(new Error('failed'))),
	).rejects.toThrow('failed')
	expect(cache.size).toBe(0)
})
