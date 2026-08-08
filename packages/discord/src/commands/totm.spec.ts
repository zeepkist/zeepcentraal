import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { totmHandler } from './totm'

test('totm delegates tournament type one', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		history: { edges: [{ node: { id: 2, slug: 'month-1', endAt: '2026-08-07T00:00:00Z' } }] },
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('totm')
	await totmHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ type: 1 })
	expect(JSON.stringify(state.edit)).toContain('Track of the Month')
})
