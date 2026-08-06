import { expect, mock, test } from 'bun:test'
import { MessageFlags } from 'discord.js'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { linkHandler } from './link'

test('link explains browser flow when code is omitted', async () => {
	const { interaction, state } = createChatInteraction('link')
	const { context } = createMockContext()
	await linkHandler(interaction, context)
	expect(state.reply).toMatchObject({ flags: MessageFlags.Ephemeral })
	expect(JSON.stringify(state.reply)).toContain('/settings/discord')
})

test('link redeems code and confirms success', async () => {
	const redeem = mock(async () => ({ status: 'linked' }))
	const { context } = createMockContext({ backend: { redeem } })
	const { interaction, state } = createChatInteraction('link', {
		strings: { code: '12345678' },
	})
	await linkHandler(interaction, context)
	expect(redeem).toHaveBeenCalledWith('12345678', 'discord-1')
	expect(JSON.stringify(state.reply)).toContain('Account linked')
})

test('link reports rejected code status', async () => {
	const { context } = createMockContext({
		backend: { redeem: mock(async () => ({ status: 'expired' })) },
	})
	const { interaction } = createChatInteraction('link', { strings: { code: '12345678' } })
	expect(linkHandler(interaction, context)).rejects.toThrow('Link failed: expired.')
})
