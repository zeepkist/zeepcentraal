import type { LocalPlaylist, LocalPlaylistLevel } from '~/types/app'

const DATABASE_NAME = 'zeepcentraal-playlists'
const DATABASE_VERSION = 1
const PLAYLIST_STORE = 'playlists'
const METADATA_STORE = 'metadata'
const ACTIVE_PLAYLIST_KEY = 'activePlaylistId'

export type PlaylistDatabaseSnapshot = {
	playlists: LocalPlaylist[]
	activePlaylistId: string | null
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
	})
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve()
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'))
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
	})
}

export class PlaylistDatabase {
	private databasePromise?: Promise<IDBDatabase>

	constructor(private readonly factory: IDBFactory = indexedDB) {}

	private open() {
		this.databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION)
			request.onupgradeneeded = () => {
				const database = request.result
				if (!database.objectStoreNames.contains(PLAYLIST_STORE)) {
					database.createObjectStore(PLAYLIST_STORE, { keyPath: 'id' })
				}
				if (!database.objectStoreNames.contains(METADATA_STORE)) {
					database.createObjectStore(METADATA_STORE)
				}
			}
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
		})
		return this.databasePromise
	}

	async load(): Promise<PlaylistDatabaseSnapshot> {
		const database = await this.open()
		const transaction = database.transaction([PLAYLIST_STORE, METADATA_STORE], 'readonly')
		const playlistsRequest = transaction.objectStore(PLAYLIST_STORE).getAll()
		const activeRequest = transaction.objectStore(METADATA_STORE).get(ACTIVE_PLAYLIST_KEY)
		const [records, activePlaylistId] = await Promise.all([
			requestResult(playlistsRequest),
			requestResult(activeRequest),
			transactionDone(transaction),
		])
		return {
			playlists: records.filter(isStoredPlaylist),
			activePlaylistId: typeof activePlaylistId === 'string' ? activePlaylistId : null,
		}
	}

	async save(snapshot: PlaylistDatabaseSnapshot): Promise<void> {
		const database = await this.open()
		const transaction = database.transaction([PLAYLIST_STORE, METADATA_STORE], 'readwrite')
		const playlistStore = transaction.objectStore(PLAYLIST_STORE)
		playlistStore.clear()
		for (const playlist of snapshot.playlists) playlistStore.put(structuredClone(playlist))
		const metadataStore = transaction.objectStore(METADATA_STORE)
		if (snapshot.activePlaylistId)
			metadataStore.put(snapshot.activePlaylistId, ACTIVE_PLAYLIST_KEY)
		else metadataStore.delete(ACTIVE_PLAYLIST_KEY)
		await transactionDone(transaction)
	}
}

function isStoredPlaylist(value: unknown): value is LocalPlaylist {
	if (typeof value !== 'object' || value === null) return false
	const record = value as Partial<LocalPlaylist>
	return (
		typeof record.id === 'string' &&
		typeof record.name === 'string' &&
		typeof record.roundLength === 'number' &&
		typeof record.shufflePlaylist === 'boolean' &&
		Array.isArray(record.levels) &&
		record.levels.length <= 1000 &&
		record.levels.every(isStoredPlaylistLevel) &&
		new Set(record.levels.map((level) => level.UID)).size === record.levels.length &&
		typeof record.createdAt === 'string' &&
		typeof record.updatedAt === 'string'
	)
}

function isStoredPlaylistLevel(value: unknown): value is LocalPlaylistLevel {
	if (typeof value !== 'object' || value === null) return false
	const record = value as Partial<LocalPlaylistLevel>
	return (
		typeof record.UID === 'string' &&
		record.UID.length > 0 &&
		typeof record.WorkshopID === 'number' &&
		Number.isSafeInteger(record.WorkshopID) &&
		record.WorkshopID >= 0 &&
		typeof record.Name === 'string' &&
		typeof record.Author === 'string' &&
		(record.xxHash === undefined || typeof record.xxHash === 'string') &&
		(record.imageUrl === undefined || typeof record.imageUrl === 'string')
	)
}
