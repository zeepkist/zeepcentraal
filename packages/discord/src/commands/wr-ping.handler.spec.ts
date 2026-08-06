import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { handleWrPing } from './wr-ping.handler'

test.each([true, false])('wr-ping stores %s preference', async (enabled) => {
	const setPreference = mock(async () => ({}))
	const { context } = createMockContext({ backend: { setPreference } })
	const { interaction, state } = createChatInteraction('wr-ping', {
		booleans: { enabled },
	})
	await handleWrPing(interaction, context)
	expect(setPreference).toHaveBeenCalledWith('discord-1', enabled)
	expect(JSON.stringify(state.reply)).toContain(enabled ? 'enabled' : 'disabled')
})
