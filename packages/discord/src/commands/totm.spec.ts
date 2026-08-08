import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { totmHandler } from './totm'

test('totm delegates tournament type one', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		monthly: {
			nodes: [
				{
					id: 2,
					type: 1,
					slug: 'month-1',
					endAt: '2026-08-07T00:00:00Z',
					trackTournamentResults: { nodes: [], totalCount: 0 },
				},
			],
		},
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('totm')
	await totmHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(query.mock.calls[0]?.[1]).toEqual({ now: '2026-08-06T12:00:00.000Z' })
	expect(JSON.stringify(state.edit)).toContain('Track of the Month')
})
