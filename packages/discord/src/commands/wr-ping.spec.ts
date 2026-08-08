import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { wrPingHandler } from './wr-ping'

test.each([true, false])('wr-ping stores %s preference', async (enabled) => {
	const setPreference = mock(async () => ({}))
	const { context } = createMockContext({ backend: { setPreference } })
	const { interaction, state } = createChatInteraction('wr-ping', {
		booleans: { enabled },
	})
	await wrPingHandler(interaction, context)
	expectComponentsV2(state.reply, true)
	expect(setPreference).toHaveBeenCalledWith('discord-1', enabled)
	expect(JSON.stringify(state.reply)).toContain(enabled ? 'enabled' : 'disabled')
})
