const DATABASE_NAME = 'zeepcentraal-ghost-cache'
const DATABASE_VERSION = 1
const BINARY_STORE = 'ghost-binaries'
const METADATA_STORE = 'ghost-cache-metadata'
const STATS_KEY = 'stats'

const DEFAULT_CACHE_LIMIT_BYTES = 512 * 1024 * 1024
const CACHE_QUOTA_SHARE = 0.2
const TOUCH_INTERVAL_MS = 60 * 60 * 1000

export interface GhostBinaryRevision {
	mediaRevision: string
	sourceKey: string
}

export interface GhostBinaryCacheEntry extends GhostBinaryRevision {
	blob: Blob
	byteLength: number
	cachedAt: number
	etag: string | null
	lastAccessedAt: number
	recordId: number
}

export interface GhostBinaryCacheWrite extends GhostBinaryRevision {
	blob: Blob
	etag?: string | null
	recordId: number
}

export interface GhostBinaryCacheStats {
	entryCount: number
	limitBytes: number
	totalBytes: number
}

interface StoredCacheStats {
	entryCount: number
	key: typeof STATS_KEY
	totalBytes: number
}

const memoryEntries = new Map<number, GhostBinaryCacheEntry>()
let memoryTotalBytes = 0
let databasePromise: Promise<IDBDatabase | null> | null = null
let indexedDbUnavailable = false

const now = (): number => Date.now()

function assertRecordId(recordId: number): void {
	if (!Number.isSafeInteger(recordId) || recordId <= 0) {
		throw new TypeError('Ghost record ID must be a positive safe integer')
	}
}

function assertRevision(revision: GhostBinaryRevision): void {
	if (!revision.sourceKey || !revision.mediaRevision) {
		throw new TypeError('Ghost binary cache revision requires sourceKey and mediaRevision')
	}
}

function emptyStoredStats(): StoredCacheStats {
	return { key: STATS_KEY, entryCount: 0, totalBytes: 0 }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
	})
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction was aborted'))
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'))
	})
}

function isStoredEntry(value: unknown): value is GhostBinaryCacheEntry {
	if (!value || typeof value !== 'object') return false
	const entry = value as Partial<GhostBinaryCacheEntry>
	return (
		Number.isSafeInteger(entry.recordId) &&
		(entry.recordId ?? 0) > 0 &&
		entry.blob instanceof Blob &&
		typeof entry.byteLength === 'number' &&
		typeof entry.sourceKey === 'string' &&
		typeof entry.mediaRevision === 'string' &&
		typeof entry.cachedAt === 'number' &&
		typeof entry.lastAccessedAt === 'number'
	)
}

function openDatabase(): Promise<IDBDatabase | null> {
	if (indexedDbUnavailable || typeof indexedDB === 'undefined') return Promise.resolve(null)
	if (databasePromise) return databasePromise

	databasePromise = new Promise((resolve) => {
		let request: IDBOpenDBRequest
		let blocked = false
		try {
			request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
		} catch {
			indexedDbUnavailable = true
			resolve(null)
			return
		}

		request.onupgradeneeded = () => {
			const database = request.result
			if (!database.objectStoreNames.contains(BINARY_STORE)) {
				const binaries = database.createObjectStore(BINARY_STORE, { keyPath: 'recordId' })
				binaries.createIndex('lastAccessedAt', 'lastAccessedAt')
				binaries.createIndex('cachedAt', 'cachedAt')
			}
			if (!database.objectStoreNames.contains(METADATA_STORE)) {
				const metadata = database.createObjectStore(METADATA_STORE, { keyPath: 'key' })
				metadata.put(emptyStoredStats())
			}
		}
		request.onsuccess = () => {
			const database = request.result
			if (blocked) {
				database.close()
				return
			}
			database.onversionchange = () => {
				database.close()
				databasePromise = null
			}
			resolve(database)
		}
		request.onerror = () => {
			indexedDbUnavailable = true
			databasePromise = null
			resolve(null)
		}
		request.onblocked = () => {
			blocked = true
			databasePromise = null
			resolve(null)
		}
	})

	return databasePromise
}

async function disableIndexedDb(database: IDBDatabase): Promise<void> {
	database.close()
	indexedDbUnavailable = true
	databasePromise = null
}

function getMemoryEntry(recordId: number): GhostBinaryCacheEntry | null {
	return memoryEntries.get(recordId) ?? null
}

function deleteMemoryEntry(recordId: number): void {
	const existing = memoryEntries.get(recordId)
	if (!existing) return
	memoryEntries.delete(recordId)
	memoryTotalBytes = Math.max(0, memoryTotalBytes - existing.byteLength)
}

function putMemoryEntry(entry: GhostBinaryCacheEntry): void {
	deleteMemoryEntry(entry.recordId)
	memoryEntries.set(entry.recordId, entry)
	memoryTotalBytes += entry.byteLength
}

async function getCacheLimitBytes(): Promise<number> {
	if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') {
		return DEFAULT_CACHE_LIMIT_BYTES
	}

	try {
		const estimate = await navigator.storage.estimate()
		if (typeof estimate.quota !== 'number' || !Number.isFinite(estimate.quota)) {
			return DEFAULT_CACHE_LIMIT_BYTES
		}
		return Math.max(
			0,
			Math.floor(Math.min(DEFAULT_CACHE_LIMIT_BYTES, estimate.quota * CACHE_QUOTA_SHARE)),
		)
	} catch {
		return DEFAULT_CACHE_LIMIT_BYTES
	}
}

async function readIndexedEntry(
	database: IDBDatabase,
	recordId: number,
): Promise<GhostBinaryCacheEntry | null> {
	const transaction = database.transaction(BINARY_STORE, 'readonly')
	const value = await requestResult(transaction.objectStore(BINARY_STORE).get(recordId))
	await transactionComplete(transaction)
	return isStoredEntry(value) ? value : null
}

async function getExistingByteLength(recordId: number): Promise<number> {
	const database = await openDatabase()
	if (database) {
		try {
			return (await readIndexedEntry(database, recordId))?.byteLength ?? 0
		} catch {
			await disableIndexedDb(database)
		}
	}
	return getMemoryEntry(recordId)?.byteLength ?? 0
}

async function readStoredStats(transaction: IDBTransaction): Promise<StoredCacheStats> {
	const value = await requestResult(transaction.objectStore(METADATA_STORE).get(STATS_KEY))
	if (!value || typeof value !== 'object') return emptyStoredStats()
	const stats = value as Partial<StoredCacheStats>
	return {
		key: STATS_KEY,
		entryCount: Math.max(0, Number(stats.entryCount) || 0),
		totalBytes: Math.max(0, Number(stats.totalBytes) || 0),
	}
}

async function writeIndexedEntry(
	database: IDBDatabase,
	entry: GhostBinaryCacheEntry,
): Promise<void> {
	const transaction = database.transaction([BINARY_STORE, METADATA_STORE], 'readwrite')
	const binaries = transaction.objectStore(BINARY_STORE)
	const metadata = transaction.objectStore(METADATA_STORE)
	const existingValue = await requestResult(binaries.get(entry.recordId))
	const existing = isStoredEntry(existingValue) ? existingValue : null
	const stats = await readStoredStats(transaction)

	binaries.put(entry)
	metadata.put({
		key: STATS_KEY,
		entryCount: stats.entryCount + (existing ? 0 : 1),
		totalBytes: Math.max(0, stats.totalBytes - (existing?.byteLength ?? 0) + entry.byteLength),
	} satisfies StoredCacheStats)
	await transactionComplete(transaction)
}

async function deleteIndexedEntry(database: IDBDatabase, recordId: number): Promise<void> {
	const transaction = database.transaction([BINARY_STORE, METADATA_STORE], 'readwrite')
	const binaries = transaction.objectStore(BINARY_STORE)
	const metadata = transaction.objectStore(METADATA_STORE)
	const existingValue = await requestResult(binaries.get(recordId))
	const existing = isStoredEntry(existingValue) ? existingValue : null

	if (existing) {
		const stats = await readStoredStats(transaction)
		binaries.delete(recordId)
		metadata.put({
			key: STATS_KEY,
			entryCount: Math.max(0, stats.entryCount - 1),
			totalBytes: Math.max(0, stats.totalBytes - existing.byteLength),
		} satisfies StoredCacheStats)
	}
	await transactionComplete(transaction)
}

async function touchIndexedEntry(
	database: IDBDatabase,
	recordId: number,
	timestamp: number,
): Promise<void> {
	const transaction = database.transaction(BINARY_STORE, 'readwrite')
	const store = transaction.objectStore(BINARY_STORE)
	const value = await requestResult(store.get(recordId))
	if (isStoredEntry(value) && timestamp - value.lastAccessedAt >= TOUCH_INTERVAL_MS) {
		store.put({ ...value, lastAccessedAt: timestamp })
	}
	await transactionComplete(transaction)
}

async function pruneIndexedEntries(
	database: IDBDatabase,
	targetBytes: number,
	protectedRecordIds: ReadonlySet<number>,
): Promise<void> {
	const transaction = database.transaction([BINARY_STORE, METADATA_STORE], 'readwrite')
	const binaries = transaction.objectStore(BINARY_STORE)
	const metadata = transaction.objectStore(METADATA_STORE)
	const stats = await readStoredStats(transaction)
	if (stats.totalBytes <= targetBytes) {
		await transactionComplete(transaction)
		return
	}

	await new Promise<void>((resolve, reject) => {
		const request = binaries.index('lastAccessedAt').openCursor()
		request.onerror = () => reject(request.error ?? new Error('IndexedDB cursor failed'))
		request.onsuccess = () => {
			const cursor = request.result
			if (!cursor || stats.totalBytes <= targetBytes) {
				metadata.put(stats)
				resolve()
				return
			}

			const entry = cursor.value
			if (isStoredEntry(entry) && !protectedRecordIds.has(entry.recordId)) {
				cursor.delete()
				stats.entryCount = Math.max(0, stats.entryCount - 1)
				stats.totalBytes = Math.max(0, stats.totalBytes - entry.byteLength)
			}
			cursor.continue()
		}
	})
	await transactionComplete(transaction)
}

function pruneMemoryEntries(targetBytes: number, protectedRecordIds: ReadonlySet<number>): void {
	if (memoryTotalBytes <= targetBytes) return
	const oldestFirst = [...memoryEntries.values()].sort(
		(left, right) => left.lastAccessedAt - right.lastAccessedAt,
	)
	for (const entry of oldestFirst) {
		if (memoryTotalBytes <= targetBytes) break
		if (!protectedRecordIds.has(entry.recordId)) deleteMemoryEntry(entry.recordId)
	}
}

export function createGhostBinarySourceKey(url: string | URL): string {
	const parsed = url instanceof URL ? url : new URL(url)
	return `${parsed.origin}${parsed.pathname}`
}

export async function getGhostBinary(
	recordId: number,
	expected: GhostBinaryRevision,
): Promise<GhostBinaryCacheEntry | null> {
	assertRecordId(recordId)
	assertRevision(expected)
	const database = await openDatabase()
	let entry: GhostBinaryCacheEntry | null

	if (database) {
		try {
			entry = await readIndexedEntry(database, recordId)
		} catch {
			await disableIndexedDb(database)
			entry = getMemoryEntry(recordId)
		}
	} else {
		entry = getMemoryEntry(recordId)
	}

	if (!entry) return null
	if (
		entry.sourceKey !== expected.sourceKey ||
		entry.mediaRevision !== expected.mediaRevision ||
		entry.byteLength !== entry.blob.size
	) {
		await deleteGhostBinary(recordId)
		return null
	}

	await touchGhostBinary(recordId)
	return entry
}

export async function putGhostBinary(input: GhostBinaryCacheWrite): Promise<void> {
	assertRecordId(input.recordId)
	assertRevision(input)
	if (!(input.blob instanceof Blob))
		throw new TypeError('Ghost binary cache value must be a Blob')

	const limitBytes = await getCacheLimitBytes()
	if (input.blob.size > limitBytes) return

	const existingByteLength = await getExistingByteLength(input.recordId)
	const requiredBytes = Math.max(0, input.blob.size - existingByteLength)
	await pruneGhostBinaryCache(requiredBytes, new Set([input.recordId]))
	const timestamp = now()
	const entry: GhostBinaryCacheEntry = {
		recordId: input.recordId,
		blob: input.blob,
		byteLength: input.blob.size,
		sourceKey: input.sourceKey,
		mediaRevision: input.mediaRevision,
		etag: input.etag ?? null,
		cachedAt: timestamp,
		lastAccessedAt: timestamp,
	}

	const database = await openDatabase()
	if (database) {
		try {
			await writeIndexedEntry(database, entry)
			return
		} catch (error) {
			if (error instanceof DOMException && error.name === 'QuotaExceededError') {
				await pruneGhostBinaryCache(input.blob.size)
				try {
					await writeIndexedEntry(database, entry)
					return
				} catch {
					// Continue without persistent storage.
				}
			}
			await disableIndexedDb(database)
		}
	}
	putMemoryEntry(entry)
}

export async function deleteGhostBinary(recordId: number): Promise<void> {
	assertRecordId(recordId)
	deleteMemoryEntry(recordId)
	const database = await openDatabase()
	if (!database) return
	try {
		await deleteIndexedEntry(database, recordId)
	} catch {
		await disableIndexedDb(database)
	}
}

export async function touchGhostBinary(recordId: number): Promise<void> {
	assertRecordId(recordId)
	const timestamp = now()
	const memoryEntry = getMemoryEntry(recordId)
	if (memoryEntry && timestamp - memoryEntry.lastAccessedAt >= TOUCH_INTERVAL_MS) {
		memoryEntries.set(recordId, { ...memoryEntry, lastAccessedAt: timestamp })
	}

	const database = await openDatabase()
	if (!database) return
	try {
		await touchIndexedEntry(database, recordId, timestamp)
	} catch {
		await disableIndexedDb(database)
	}
}

export async function pruneGhostBinaryCache(
	requiredBytes = 0,
	protectedRecordIds: ReadonlySet<number> = new Set(),
): Promise<GhostBinaryCacheStats> {
	if (!Number.isSafeInteger(requiredBytes) || requiredBytes < 0) {
		throw new TypeError('Required ghost cache bytes must be a non-negative safe integer')
	}
	const limitBytes = await getCacheLimitBytes()
	const targetBytes = Math.max(0, limitBytes - requiredBytes)
	const database = await openDatabase()

	if (database) {
		try {
			await pruneIndexedEntries(database, targetBytes, protectedRecordIds)
		} catch {
			await disableIndexedDb(database)
			pruneMemoryEntries(targetBytes, protectedRecordIds)
		}
	} else {
		pruneMemoryEntries(targetBytes, protectedRecordIds)
	}
	return getGhostBinaryCacheStats()
}

export async function clearGhostBinaryCache(): Promise<void> {
	memoryEntries.clear()
	memoryTotalBytes = 0
	const database = await openDatabase()
	if (!database) return

	try {
		const transaction = database.transaction([BINARY_STORE, METADATA_STORE], 'readwrite')
		transaction.objectStore(BINARY_STORE).clear()
		transaction.objectStore(METADATA_STORE).put(emptyStoredStats())
		await transactionComplete(transaction)
	} catch {
		await disableIndexedDb(database)
	}
}

export async function getGhostBinaryCacheStats(): Promise<GhostBinaryCacheStats> {
	const limitBytes = await getCacheLimitBytes()
	const database = await openDatabase()
	if (database) {
		try {
			const transaction = database.transaction(METADATA_STORE, 'readonly')
			const stored = await readStoredStats(transaction)
			await transactionComplete(transaction)
			return { entryCount: stored.entryCount, totalBytes: stored.totalBytes, limitBytes }
		} catch {
			await disableIndexedDb(database)
		}
	}

	return { entryCount: memoryEntries.size, totalBytes: memoryTotalBytes, limitBytes }
}
