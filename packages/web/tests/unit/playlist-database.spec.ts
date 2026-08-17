import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import type { LocalPlaylist } from '~/types/app'
import { PlaylistDatabase } from '~/utils/playlistDatabase.client'

function playlist(id: string): LocalPlaylist {
	return {
		id,
		name: `Playlist ${id}`,
		roundLength: 480,
		shufflePlaylist: false,
		levels: [{ UID: `uid-${id}`, WorkshopID: 123, Name: 'Level', Author: 'Author' }],
		createdAt: '2026-08-16T00:00:00.000Z',
		updatedAt: '2026-08-16T00:00:00.000Z',
	}
}

describe('playlist IndexedDB repository', () => {
	it('persists playlists and active ID across repository instances', async () => {
		const factory = new IDBFactory()
		await new PlaylistDatabase(factory).save({
			playlists: [playlist('one'), playlist('two')],
			activePlaylistId: 'two',
		})

		await expect(new PlaylistDatabase(factory).load()).resolves.toEqual({
			playlists: [playlist('one'), playlist('two')],
			activePlaylistId: 'two',
		})
	})

	it('replaces deleted records and clears active ID', async () => {
		const database = new PlaylistDatabase(new IDBFactory())
		await database.save({ playlists: [playlist('one')], activePlaylistId: 'one' })
		await database.save({ playlists: [], activePlaylistId: null })

		await expect(database.load()).resolves.toEqual({ playlists: [], activePlaylistId: null })
	})

	it('skips corrupt records without losing healthy records', async () => {
		const factory = new IDBFactory()
		const database = new PlaylistDatabase(factory)
		await database.save({ playlists: [playlist('healthy')], activePlaylistId: 'healthy' })

		const opened = factory.open('zeepcentraal-playlists', 1)
		const rawDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
			opened.onsuccess = () => resolve(opened.result)
			opened.onerror = () => reject(opened.error)
		})
		const transaction = rawDatabase.transaction('playlists', 'readwrite')
		transaction.objectStore('playlists').put({
			...playlist('corrupt'),
			levels: [{ UID: '', WorkshopID: Number.MAX_SAFE_INTEGER + 1 }],
		})
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve()
			transaction.onerror = () => reject(transaction.error)
		})

		const loaded = await database.load()
		expect(loaded.playlists).toEqual([playlist('healthy')])
	})
})
