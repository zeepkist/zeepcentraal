import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { totwHandler } from './totw'

test('totw delegates tournament type zero', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		active: { nodes: [{ id: 1, slug: 'week-1', endAt: '2026-08-07T00:00:00Z' }] },
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('totw')
	await totwHandler(interaction, context)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ type: 0 })
	expect(JSON.stringify(state.edit)).toContain('Track of the Week')
})
