import { expect, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { helpHandler } from './help'

test('help renders command guide', async () => {
	const { context } = createMockContext()
	const { interaction, state } = createChatInteraction('help')
	await helpHandler(interaction, context)
	expect(JSON.stringify(state.reply)).toContain('/playlist-recommend')
})
