import { expect, mock, test } from 'bun:test'
import { displayText, expectComponentsV2 } from '../../test/components'
import {
	createChatInteraction,
	createMockContext,
	linkedState,
	linkedUser,
	unlinkedState,
} from '../../test/mocks'
import { compareHandler } from './compare'

test('compare renders command owner and opponent profiles', async () => {
	const user = mock(async (id: string) =>
		id === 'discord-1' ? linkedState : { ...linkedState, linkedUser: { ...linkedUser, id: 8 } },
	)
	let lookup = 0
	const userByFilter = mock(async () =>
		lookup++ === 0
			? {
					steamName: 'First',
					discordId: 'discord-1',
					userPoints: { rank: 2, points: 1500, worldRecords: 3 },
				}
			: { steamName: 'Second', discordId: '-1', userPoints: null },
	)
	const { context } = createMockContext({ backend: { user }, graphql: { userByFilter } })
	const { interaction, state } = createChatInteraction('compare', {
		users: { player: { id: 'discord-2' } },
	})
	await compareHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(displayText(state.edit)).toContain('### You')
	expect(displayText(state.edit)).toContain('### Opponent')
	expect(displayText(state.edit)).toContain('Rank Unranked')
})

test('compare requires both accounts linked', async () => {
	const first = createMockContext({ backend: { user: mock(async () => unlinkedState) } }).context
	const interaction = createChatInteraction('compare', {
		users: { player: { id: 'discord-2' } },
	}).interaction
	expect(compareHandler(interaction, first)).rejects.toThrow('Link account first')

	const user = mock(async (id: string) => (id === 'discord-1' ? linkedState : unlinkedState))
	const second = createMockContext({ backend: { user } }).context
	expect(compareHandler(interaction, second)).rejects.toThrow('Link account first')
})
