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
	private baseline = new Map<string, LocalPlaylist>()

	subscribe(listener: () => void) {
		const channel = new BroadcastChannel(DATABASE_NAME)
		channel.onmessage = listener
		return () => channel.close()
	}

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

	private async read(): Promise<PlaylistDatabaseSnapshot> {
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

	async load(): Promise<PlaylistDatabaseSnapshot> {
		const stored = await this.read()
		this.baseline = new Map(
			stored.playlists.map((playlist) => [playlist.id, structuredClone(playlist)]),
		)
		return stored
	}

	// Adopt remote changes only for records without pending local edits.
	async refresh(
		localSnapshot: () => PlaylistDatabaseSnapshot,
	): Promise<PlaylistDatabaseSnapshot> {
		const stored = await this.read()
		const local = localSnapshot()
		const merged = new Map(stored.playlists.map((playlist) => [playlist.id, playlist]))
		const localRecords = new Map(local.playlists.map((playlist) => [playlist.id, playlist]))
		for (const id of new Set([...this.baseline.keys(), ...localRecords.keys()])) {
			const previous = this.baseline.get(id)
			const pending = localRecords.get(id)
			if (JSON.stringify(previous) !== JSON.stringify(pending)) {
				if (pending) merged.set(id, pending)
				else merged.delete(id)
			} else {
				const remote = merged.get(id)
				if (remote) this.baseline.set(id, structuredClone(remote))
				else this.baseline.delete(id)
			}
		}
		for (const remote of stored.playlists) {
			if (
				!localRecords.has(remote.id) &&
				!this.baseline.has(remote.id) &&
				merged.has(remote.id)
			) {
				this.baseline.set(remote.id, structuredClone(remote))
			}
		}
		return {
			playlists: [...merged.values()],
			activePlaylistId:
				local.activePlaylistId && merged.has(local.activePlaylistId)
					? local.activePlaylistId
					: stored.activePlaylistId && merged.has(stored.activePlaylistId)
						? stored.activePlaylistId
						: (merged.keys().next().value ?? null),
		}
	}

	async save(snapshot: PlaylistDatabaseSnapshot): Promise<void> {
		const pending = new Map(
			snapshot.playlists.map((playlist) => [playlist.id, structuredClone(playlist)]),
		)
		const changed = [...new Set([...this.baseline.keys(), ...pending.keys()])].filter(
			(id) => JSON.stringify(this.baseline.get(id)) !== JSON.stringify(pending.get(id)),
		)
		const database = await this.open()
		const transaction = database.transaction([PLAYLIST_STORE, METADATA_STORE], 'readwrite')
		const done = transactionDone(transaction)
		const playlistStore = transaction.objectStore(PLAYLIST_STORE)
		try {
			// Compare complete stored values as revisions; timestamps alone can collide.
			const current = await Promise.all(
				changed.map((id) => requestResult(playlistStore.get(id))),
			)
			for (const [index, id] of changed.entries()) {
				if (JSON.stringify(current[index]) !== JSON.stringify(this.baseline.get(id))) {
					throw new Error('Playlist changed in another tab. Local edits remain unsaved.')
				}
			}
			for (const id of changed) {
				const playlist = pending.get(id)
				if (playlist) playlistStore.put(playlist)
				else playlistStore.delete(id)
			}
			const metadataStore = transaction.objectStore(METADATA_STORE)
			if (snapshot.activePlaylistId)
				metadataStore.put(snapshot.activePlaylistId, ACTIVE_PLAYLIST_KEY)
			else metadataStore.delete(ACTIVE_PLAYLIST_KEY)
			await done
		} catch (error) {
			try {
				transaction.abort()
			} catch {
				/* Transaction may already have aborted. */
			}
			await done.catch(() => undefined)
			throw error
		}
		this.baseline = pending
		if (typeof BroadcastChannel !== 'undefined') {
			const channel = new BroadcastChannel(DATABASE_NAME)
			channel.postMessage(null)
			channel.close()
		}
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
