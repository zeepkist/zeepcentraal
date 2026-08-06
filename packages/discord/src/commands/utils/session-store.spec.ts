import { expect, test } from 'bun:test'
import { CommandSessionStore } from './session-store'

test('session store creates, reads, and expires both session kinds', () => {
	let now = 100
	let id = 0
	const store = new CommandSessionStore({ now: () => now, id: () => `id-${++id}`, ttl: 10 })
	const page = store.createPages('owner', [{ title: 'Title', description: 'Description' }])
	const playlist = store.createPlaylist('owner', 'file.zeeplist', '{}')
	expect(store.page(page.id)).toBe(page.session)
	expect(store.playlist(playlist)?.filename).toBe('file.zeeplist')
	now = 110
	store.cleanup()
	expect(store.page(page.id)).toBeUndefined()
	expect(store.playlist(playlist)).toBeUndefined()
})

test('session store defaults create usable sessions', () => {
	const store = new CommandSessionStore()
	const page = store.createPages('owner', [])
	const playlist = store.createPlaylist('owner', 'default.zeeplist', 'content')
	expect(store.page(page.id)?.ownerId).toBe('owner')
	expect(store.playlist(playlist)?.content).toBe('content')
	store.cleanup()
})
