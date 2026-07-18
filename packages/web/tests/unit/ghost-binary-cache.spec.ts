import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	clearGhostBinaryCache,
	createGhostBinarySourceKey,
	deleteGhostBinary,
	getGhostBinary,
	getGhostBinaryCacheStats,
	pruneGhostBinaryCache,
	putGhostBinary,
	touchGhostBinary,
} from '../../app/utils/ghostBinaryCache.client'

const revision = {
	sourceKey: 'https://ghosts.example.test/records/42.ghost',
	mediaRevision: '2026-07-18T12:00:00.000Z',
}

function setQuota(quota: number): void {
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: {
			storage: {
				estimate: async () => ({ quota }),
			},
		},
	})
}

const originalDateNow = Date.now
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
let timestamp = new Date('2026-07-18T12:00:00.000Z').getTime()

describe('ghost binary cache', () => {
	beforeEach(async () => {
		Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
		setQuota(1_000)
		timestamp = new Date('2026-07-18T12:00:00.000Z').getTime()
		Date.now = () => timestamp
		await clearGhostBinaryCache()
	})

	afterEach(() => {
		Date.now = originalDateNow
		restoreGlobal('navigator', originalNavigator)
		restoreGlobal('indexedDB', originalIndexedDb)
	})

	it('normalizes source URLs without query strings or fragments', () => {
		expect(
			createGhostBinarySourceKey(
				'https://ghosts.example.test/records/42.ghost?signature=secret#download',
			),
		).toBe('https://ghosts.example.test/records/42.ghost')
	})

	it('stores raw compressed blobs and reports cache usage', async () => {
		const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00])
		await putGhostBinary({
			recordId: 42,
			blob: new Blob([bytes], { type: 'application/octet-stream' }),
			...revision,
			etag: '"ghost-v1"',
		})

		const entry = await getGhostBinary(42, revision)
		expect(entry?.etag).toBe('"ghost-v1"')
		expect(entry?.blob.type).toBe('application/octet-stream')
		expect(new Uint8Array(await entry?.blob.arrayBuffer())).toEqual(bytes)
		expect(await getGhostBinaryCacheStats()).toEqual({
			entryCount: 1,
			totalBytes: 4,
			limitBytes: 200,
		})
	})

	it('invalidates entries when media source or revision changes', async () => {
		await putGhostBinary({ recordId: 42, blob: new Blob(['ghost']), ...revision })

		expect(
			await getGhostBinary(42, { ...revision, mediaRevision: '2026-07-18T13:00:00.000Z' }),
		).toBeNull()
		expect(await getGhostBinary(42, revision)).toBeNull()
		expect((await getGhostBinaryCacheStats()).entryCount).toBe(0)
	})

	it('replaces entries without double-counting bytes', async () => {
		await putGhostBinary({ recordId: 42, blob: new Blob(['old']), ...revision })
		await putGhostBinary({ recordId: 42, blob: new Blob(['replacement']), ...revision })

		expect(await getGhostBinaryCacheStats()).toMatchObject({
			entryCount: 1,
			totalBytes: 11,
		})
	})

	it('prunes least-recently-used entries while preserving protected records', async () => {
		setQuota(50)
		await putGhostBinary({ recordId: 1, blob: new Blob(['1111']), ...revision })
		timestamp += 1_000
		await putGhostBinary({ recordId: 2, blob: new Blob(['2222']), ...revision })

		await pruneGhostBinaryCache(6, new Set([1]))

		expect(await getGhostBinary(1, revision)).not.toBeNull()
		expect(await getGhostBinary(2, revision)).toBeNull()
		expect(await getGhostBinaryCacheStats()).toMatchObject({ entryCount: 1, totalBytes: 4 })
	})

	it('updates LRU access timestamps at most once per hour', async () => {
		await putGhostBinary({ recordId: 42, blob: new Blob(['ghost']), ...revision })
		const original = await getGhostBinary(42, revision)

		timestamp += 60 * 60 * 1_000 + 1
		await touchGhostBinary(42)
		const touched = await getGhostBinary(42, revision)

		expect(touched?.lastAccessedAt).toBeGreaterThan(original?.lastAccessedAt ?? 0)
	})

	it('does not persist a blob larger than the adaptive limit', async () => {
		setQuota(20)
		await putGhostBinary({ recordId: 42, blob: new Blob(['12345']), ...revision })

		expect(await getGhostBinary(42, revision)).toBeNull()
		expect(await getGhostBinaryCacheStats()).toMatchObject({ entryCount: 0, limitBytes: 4 })
	})

	it('deletes and clears entries through the public API', async () => {
		await putGhostBinary({ recordId: 41, blob: new Blob(['one']), ...revision })
		await putGhostBinary({ recordId: 42, blob: new Blob(['two']), ...revision })
		await deleteGhostBinary(41)

		expect(await getGhostBinary(41, revision)).toBeNull()
		expect((await getGhostBinaryCacheStats()).entryCount).toBe(1)

		await clearGhostBinaryCache()
		expect(await getGhostBinaryCacheStats()).toMatchObject({ entryCount: 0, totalBytes: 0 })
	})

	it('rejects unsafe record IDs and invalid revisions', async () => {
		await expect(getGhostBinary(0, revision)).rejects.toThrow('positive safe integer')
		await expect(
			putGhostBinary({ recordId: 42, blob: new Blob(['ghost']), ...revision, sourceKey: '' }),
		).rejects.toThrow('requires sourceKey and mediaRevision')
	})
})

function restoreGlobal(key: 'navigator' | 'indexedDB', descriptor?: PropertyDescriptor) {
	if (descriptor) Object.defineProperty(globalThis, key, descriptor)
	else Reflect.deleteProperty(globalThis, key)
}
