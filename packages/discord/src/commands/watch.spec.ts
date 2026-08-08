import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import {
	createChatInteraction,
	createMockContext,
	linkedState,
	unlinkedState,
} from '../../test/mocks'
import { watchHandler } from './watch'

test('watch requires linked account', async () => {
	const { context } = createMockContext({ backend: { user: mock(async () => unlinkedState) } })
	const { interaction } = createChatInteraction('watch')
	expect(watchHandler(interaction, context)).rejects.toThrow('Link account first')
})

test('watch lists active and paused entries', async () => {
	const user = mock(async () => ({
		...linkedState,
		watches: [
			{ id: '1', kind: 'level', targetId: 'hash', paused: false },
			{ id: '2', kind: 'player', targetId: '7', paused: true },
		],
	}))
	const { context } = createMockContext({ backend: { user } })
	const { interaction, state } = createChatInteraction('watch', { subcommand: 'list' })
	await watchHandler(interaction, context)
	expectComponentsV2(state.reply, true)
	expect(JSON.stringify(state.reply)).toContain('• paused')
	expect(JSON.stringify(state.reply)).toContain('hash')
})

test('watch removes entry', async () => {
	const removeWatch = mock(async () => ({}))
	const { context } = createMockContext({ backend: { removeWatch } })
	const { interaction, state } = createChatInteraction('watch', {
		subcommand: 'remove',
		strings: { id: 'watch-1' },
	})
	await watchHandler(interaction, context)
	expectComponentsV2(state.reply, true)
	expect(removeWatch).toHaveBeenCalledWith('discord-1', 'watch-1')
	expect(JSON.stringify(state.reply)).toContain('Watch removed')
})

test('watch adds entry', async () => {
	const addWatch = mock(async () => ({}))
	const { context } = createMockContext({ backend: { addWatch } })
	const { interaction, state } = createChatInteraction('watch', {
		subcommand: 'add',
		strings: { kind: 'author', target: 'Akane' },
	})
	await watchHandler(interaction, context)
	expectComponentsV2(state.reply, true)
	expect(addWatch).toHaveBeenCalledWith('discord-1', 'author', 'Akane')
	expect(JSON.stringify(state.reply)).toContain('Watch added')
})
