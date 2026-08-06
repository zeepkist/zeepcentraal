import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { handleBotStatus } from './bot-status.handler'

test('bot-status measures GraphQL health', async () => {
	const userByFilter = mock(async () => null)
	const { context } = createMockContext({
		graphql: { userByFilter },
		monotonicTimes: [100, 126],
	})
	const { interaction, state } = createChatInteraction('bot-status')
	await handleBotStatus(interaction, context)
	expect(userByFilter).toHaveBeenCalledWith({ id: { equalTo: -1 } })
	expect(JSON.stringify(state.edit)).toContain('healthy (26 ms)')
})
