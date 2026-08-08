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
})
