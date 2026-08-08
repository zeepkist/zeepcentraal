import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { totwHandler } from './totw'

test('totw delegates tournament type zero', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		weekly: {
			nodes: [
				{
					id: 1,
					type: 0,
					slug: 'week-1',
					endAt: '2026-08-07T00:00:00Z',
					trackTournamentResults: { nodes: [], totalCount: 0 },
				},
			],
		},
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('totw')
	await totwHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(query.mock.calls[0]?.[1]).toEqual({ now: '2026-08-06T12:00:00.000Z' })
	expect(JSON.stringify(state.edit)).toContain('Track of the Week')
})
