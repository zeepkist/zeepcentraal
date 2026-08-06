import { expect, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { handleHelp } from './help.handler'

test('help renders command guide', async () => {
	const { context } = createMockContext()
	const { interaction, state } = createChatInteraction('help')
	await handleHelp(interaction, context)
	expect(JSON.stringify(state.reply)).toContain('/playlist-recommend')
})
