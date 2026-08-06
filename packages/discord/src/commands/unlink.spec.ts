import { expect, mock, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { unlinkHandler } from './unlink'

test('unlink removes account association', async () => {
	const unlink = mock(async () => ({}))
	const { context } = createMockContext({ backend: { unlink } })
	const { interaction, state } = createChatInteraction('unlink')
	await unlinkHandler(interaction, context)
	expect(unlink).toHaveBeenCalledWith('discord-1')
	expect(state.reply).toEqual({
		flags: MessageFlags.Ephemeral,
		content: 'Discord account unlinked.',
	})
})
