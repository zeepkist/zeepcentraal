import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlaylistsStore } from '~/stores/playlists'
import type { LevelSummary, LocalPlaylist } from '~/types/app'
import type { PlaylistDatabase } from '~/utils/playlistDatabase.client'

function summary(overrides: Partial<LevelSummary> = {}): LevelSummary {
	return {
		id: 1,
		xxHash: 'hash',
		fileUid: 'uid-one',
		fileAuthor: 'File Author',
		name: 'Level One',
		workshopId: '123',
		adventure: false,
		dateCreated: '2026-08-16T00:00:00.000Z',
		...overrides,
	}
}

function storedPlaylist(id = 'stored'): LocalPlaylist {
	return {
		id,
		name: 'Stored',
		roundLength: 480,
		shufflePlaylist: false,
		levels: [],
		createdAt: '2026-08-16T00:00:00.000Z',
		updatedAt: '2026-08-16T00:00:00.000Z',
	}
}

function repository(overrides: Partial<PlaylistDatabase> = {}) {
	return {
		load: vi.fn(async () => ({ playlists: [], activePlaylistId: null })),
		save: vi.fn(async () => undefined),
		...overrides,
	} as unknown as PlaylistDatabase
}

describe('playlist Pinia store', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('hydrates collection and restores valid active playlist ID', async () => {
		const one = storedPlaylist('one')
		const two = storedPlaylist('two')
		const store = usePlaylistsStore()
		await store.hydrate(
			repository({
				load: vi.fn(async () => ({ playlists: [one, two], activePlaylistId: 'two' })),
			}),
		)

		expect(store.activePlaylistId).toBe('two')
		expect(store.activePlaylist?.id).toBe('two')
		expect(store.persistenceStatus).toBe('saved')
	})

	it('creates first playlist on add and prevents duplicate UID', () => {
		const store = usePlaylistsStore()

		expect(store.addLevel(summary())).toBe('added')
		expect(store.activePlaylist?.name).toBe('Untitled Playlist')
		expect(store.activePlaylist?.levels).toEqual([
			{
				UID: 'uid-one',
				WorkshopID: 123,
				Name: 'Level One',
				Author: 'File Author',
				xxHash: 'hash',
				imageUrl: undefined,
			},
		])
		expect(store.addLevel(summary())).toBe('duplicate')
		expect(store.hasLevel('uid-one')).toBe(true)
	})

	it('rejects unsafe Workshop IDs and playlist overflow', () => {
		const store = usePlaylistsStore()
		expect(store.addLevel(summary({ workshopId: '9007199254740992' }))).toBe('invalid')
		store.createPlaylist()
		store.activePlaylist?.levels.push(
			...Array.from({ length: 1000 }, (_, index) => ({
				UID: `uid-${index}`,
				WorkshopID: index,
				Name: `${index}`,
				Author: '',
			})),
		)
		expect(store.addLevel(summary())).toBe('full')
	})

	it('supports remove undo data, reinsertion, and ordered moves', () => {
		const store = usePlaylistsStore()
		store.addLevel(summary())
		store.addLevel(summary({ id: 2, fileUid: 'uid-two', xxHash: 'hash-two' }))

		store.moveLevel(1, 0)
		expect(store.activePlaylist?.levels.map((level) => level.UID)).toEqual([
			'uid-two',
			'uid-one',
		])
		const removed = store.removeLevel('uid-two')
		expect(removed?.index).toBe(0)
		expect(removed && store.addStoredLevel(removed.level, removed.index)).toBe(true)
		expect(store.activePlaylist?.levels[0]?.UID).toBe('uid-two')
	})

	it('owns unique rename, duplicate, switch, and delete mutations', () => {
		const store = usePlaylistsStore()
		const first = store.createPlaylist('Races')
		const second = store.createPlaylist('races')
		expect(second.name).toBe('races (2)')

		store.renamePlaylist(second.id, 'RACES')
		expect(second.name).toBe('RACES (2)')
		const duplicate = store.duplicatePlaylist(first.id)
		expect(duplicate?.name).toBe('Races Copy')
		store.setActivePlaylist(first.id)
		expect(store.deletePlaylist(first.id)?.id).toBe(first.id)
		expect(store.activePlaylistId).not.toBe(first.id)
	})

	it('serializes saves and recovers after a persistence error', async () => {
		const order: string[] = []
		let releaseFirst: (() => void) | undefined
		const firstSave = new Promise<void>((resolve) => {
			releaseFirst = resolve
		})
		const save = vi
			.fn()
			.mockImplementationOnce(async () => {
				order.push('first-start')
				await firstSave
				order.push('first-end')
			})
			.mockImplementationOnce(async () => {
				order.push('second')
				throw new Error('quota')
			})
			.mockImplementationOnce(async () => {
				order.push('third')
			})
		const store = usePlaylistsStore()
		await store.hydrate(repository({ save }))
		store.createPlaylist()

		const first = store.persistNow()
		const second = store.persistNow()
		await vi.waitFor(() => expect(order).toEqual(['first-start']))
		releaseFirst?.()
		await Promise.all([first, second])
		expect(order).toEqual(['first-start', 'first-end', 'second'])
		expect(store.persistenceStatus).toBe('error')
		expect(store.persistenceError).toBe('quota')

		await store.persistNow()
		expect(order).toEqual(['first-start', 'first-end', 'second', 'third'])
		expect(store.persistenceStatus).toBe('saved')
	})
})
