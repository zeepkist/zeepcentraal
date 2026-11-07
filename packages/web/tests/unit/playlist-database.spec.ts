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

function renameFirst(snapshot: { playlists: LocalPlaylist[] }, name: string) {
	const first = snapshot.playlists[0]
	if (!first) throw new Error('Missing test playlist')
	first.name = name
}

describe('playlist IndexedDB repository', () => {
	async function twoTabs() {
		const factory = new IDBFactory()
		const first = new PlaylistDatabase(factory)
		const second = new PlaylistDatabase(factory)
		await first.save({ playlists: [playlist('original')], activePlaylistId: 'original' })
		return { first, second, firstState: await first.load(), secondState: await second.load() }
	}

	it('preserves playlists added by another tab when saving a stale snapshot', async () => {
		const { first, second, firstState, secondState } = await twoTabs()
		firstState.playlists.push(playlist('new'))
		await first.save(firstState)
		renameFirst(secondState, 'Renamed')
		await second.save(secondState)
		expect((await first.load()).playlists.map((entry) => entry.id)).toEqual(['new', 'original'])
	})

	it('rejects conflicting edits atomically and retains pending local edits', async () => {
		const { first, second, firstState, secondState } = await twoTabs()
		renameFirst(firstState, 'First edit')
		await first.save(firstState)
		renameFirst(secondState, 'Second edit')
		secondState.playlists.push(playlist('unsaved'))
		await expect(second.save(secondState)).rejects.toThrow('Playlist changed in another tab')
		expect((await first.load()).playlists.map((entry) => entry.name)).toEqual(['First edit'])
		const merged = await second.refresh(() => secondState)
		expect(merged.playlists.find((entry) => entry.id === 'original')?.name).toBe('Second edit')
		await expect(second.save(merged)).rejects.toThrow('Playlist changed in another tab')
	})

	it('does not resurrect remote deletions or delete remotely edited records', async () => {
		const { first, second, secondState } = await twoTabs()
		await first.save({ playlists: [], activePlaylistId: null })
		secondState.playlists.push(playlist('new'))
		await second.save(secondState)
		expect((await first.load()).playlists.map((entry) => entry.id)).toEqual(['new'])
		await second.load()
		const remote = await first.load()
		renameFirst(remote, 'Remote edit')
		await first.save(remote)
		await expect(second.save({ playlists: [], activePlaylistId: null })).rejects.toThrow(
			'Playlist changed in another tab',
		)
	})

	it('refreshes clean records while preserving edits made during the read', async () => {
		const { first, second, firstState, secondState } = await twoTabs()
		firstState.playlists.push(playlist('remote'))
		await first.save(firstState)
		const refreshed = second.refresh(() => secondState)
		renameFirst(secondState, 'Pending local edit')
		const merged = await refreshed
		expect(merged.playlists.map((entry) => entry.id)).toEqual(['original', 'remote'])
		expect(merged.playlists[0]?.name).toBe('Pending local edit')
		await second.save(merged)
		expect((await first.load()).playlists).toHaveLength(2)
	})
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
