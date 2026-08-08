import { expect, mock, test } from 'bun:test'
import { displayText, expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { unlinkHandler } from './unlink'

test('unlink removes account association', async () => {
	const unlink = mock(async () => ({}))
	const { context } = createMockContext({ backend: { unlink } })
	const { interaction, state } = createChatInteraction('unlink')
	await unlinkHandler(interaction, context)
	expect(unlink).toHaveBeenCalledWith('discord-1')
	expectComponentsV2(state.reply, true)
	expect(displayText(state.reply)).toContain('Discord account unlinked.')
})
