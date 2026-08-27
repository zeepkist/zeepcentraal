import { expect, test } from 'bun:test'
import { CommandSessionStore, type PageResult } from './session-store'

const page: PageResult = {
	pageInfo: { hasNextPage: false, hasPreviousPage: false },
	rows: ['Description'],
	totalCount: 1,
}

const loader = async () => page

test('session store creates, reads, and expires both session kinds', () => {
	let now = 100
	let id = 0
	const store = new CommandSessionStore({ now: () => now, id: () => `id-${++id}`, ttl: 10 })
	const pagination = store.createPages('owner', 10, page, { title: 'Title' }, loader)
	const playlist = store.createPlaylist('owner', 'file.zeeplist', '{}')
	expect(store.page(pagination.id)).toBe(pagination.session)
	expect(store.page(pagination.id)?.presentation.title).toBe('Title')
	expect(store.playlist(playlist)?.filename).toBe('file.zeeplist')
	now = 110
	store.cleanup()
	expect(store.page(pagination.id)).toBeUndefined()
	expect(store.playlist(playlist)).toBeUndefined()
})

test('session store defaults create usable sessions', () => {
	const store = new CommandSessionStore()
	const pagination = store.createPages('owner', 10, page, { title: 'Title' }, loader)
	const playlist = store.createPlaylist('owner', 'default.zeeplist', 'content')
	expect(store.page(pagination.id)?.ownerId).toBe('owner')
	expect(store.playlist(playlist)?.content).toBe('content')
	store.cleanup()
	store[Symbol.dispose]()
})

test('session store evicts oldest entries and releases all retained content', () => {
	let id = 0
	const store = new CommandSessionStore({
		id: () => `id-${++id}`,
		maxPageSessions: 1,
		maxPlaylistBytes: 12,
		maxPlaylistSessions: 2,
	})
	const firstPage = store.createPages('owner', 10, page, { title: 'First' }, loader)
	const secondPage = store.createPages('owner', 10, page, { title: 'Second' }, loader)
	const firstPlaylist = store.createPlaylist('owner', 'one', '1234')
	const secondPlaylist = store.createPlaylist('owner', 'two', '5678')

	expect(store.page(firstPage.id)).toBeUndefined()
	expect(store.page(secondPage.id)).toBeDefined()
	expect(store.playlist(firstPlaylist)).toBeUndefined()
	expect(store.playlist(secondPlaylist)).toBeDefined()
	expect(store.stats()).toEqual({ pages: 1, playlistBytes: 8, playlists: 1 })
	expect(() => store.createPlaylist('owner', 'large', '1234567')).toThrow(
		'Playlist session is too large',
	)
	store[Symbol.dispose]()
	expect(store.stats()).toEqual({ pages: 0, playlistBytes: 0, playlists: 0 })
})
