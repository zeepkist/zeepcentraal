import { expect, test } from 'bun:test'
import { displayText, expectComponentsV2 } from '../../../test/components'
import { createButtonInteraction, createMockContext } from '../../../test/mocks'
import { createPlaylist, type PlaylistLevel, playlistHandler, playlistResponse } from './playlist'

const complete: PlaylistLevel = {
	id: 1,
	xxHash: 'hash-1',
	levelItems: {
		nodes: [{ name: 'One', fileUid: 'uid-1', fileAuthor: 'Author', workshopId: 42 }],
	},
}

test('playlist serializer preserves metadata and fallbacks', () => {
	const result = createPlaylist('Test', [complete, { id: 2, xxHash: 'hash-2' }])
	expect(result.levels).toEqual([
		{ UID: 'uid-1', WorkshopID: '42', Name: 'One', Author: 'Author' },
		{ UID: 'hash-2', WorkshopID: '-1', Name: 'hash-2', Author: 'Unknown' },
	])
})

test('playlist response stores deterministic download and limits preview', () => {
	const { context } = createMockContext()
	const levels = Array.from({ length: 16 }, (_, index) => ({
		...complete,
		id: index,
		xxHash: `hash-${index}`,
		levelItems: { nodes: [{ name: `Level ${index}` }] },
	}))
	const response = playlistResponse(context, 'discord-1', 'My !! Playlist', levels, [])
	expectComponentsV2(response)
	expect(displayText(response)).toContain('**Filters**  None')
	expect(displayText(response)).toContain('Level 14')
	expect(displayText(response)).not.toContain('Level 15')
	const session = context.runtime.sessions.playlist('session-1')
	expect(session?.filename).toBe('my-playlist-2026-08-06.zeeplist')
})

test('playlist response rejects empty levels', () => {
	const { context } = createMockContext()
	expect(() => playlistResponse(context, 'owner', 'Empty', [], ['filter'])).toThrow(
		'No public levels matched these filters.',
	)
})

test('playlist button handles expiry, ownership, and attachment', async () => {
	const { context } = createMockContext()
	const expired = createButtonInteraction('playlist:missing')
	await playlistHandler(expired.interaction, context, 'missing')
	expectComponentsV2(expired.state.reply, true)
	expect(displayText(expired.state.reply)).toContain('download expired')

	context.runtime.sessions.createPlaylist('discord-1', 'file.zeeplist', 'content')
	const wrong = createButtonInteraction('playlist:session-1', 'other')
	await playlistHandler(wrong.interaction, context, 'session-1')
	expectComponentsV2(wrong.state.reply, true)
	expect(displayText(wrong.state.reply)).toContain('Only command owner')

	const owner = createButtonInteraction('playlist:session-1')
	await playlistHandler(owner.interaction, context, 'session-1')
	expectComponentsV2(owner.state.reply, true)
	expect(JSON.stringify(owner.state.reply)).toContain('attachment://file.zeeplist')
	const reply = owner.state.reply as { files: Array<{ name: string; attachment: Buffer }> }
	expect(reply.files[0]?.name).toBe('file.zeeplist')
	expect(reply.files[0]?.attachment.toString()).toBe('content')
})
