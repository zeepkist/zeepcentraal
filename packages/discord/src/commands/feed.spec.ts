import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { feedHandler } from './feed'

test('feed requires guild context', async () => {
	const { interaction } = createChatInteraction('feed')
	const { context } = createMockContext()
	expect(feedHandler(interaction, context)).rejects.toThrow('Run this command inside a server.')
})

test.each([true, false])('feed stores enabled=%s configuration', async (enabled) => {
	const setFeed = mock(async () => ({}))
	const { context } = createMockContext({ backend: { setFeed } })
	const { interaction, state } = createChatInteraction('feed', {
		guildId: 'guild-1',
		strings: { kind: 'world_record' },
		channels: { channel: { id: 'channel-1' } },
		booleans: { enabled },
	})
	await feedHandler(interaction, context)
	expectComponentsV2(state.reply, true)
	expect(setFeed).toHaveBeenCalledWith('guild-1', 'world_record', 'channel-1', enabled)
	expect(JSON.stringify(state.reply)).toContain(enabled ? 'enabled' : 'disabled')
})
