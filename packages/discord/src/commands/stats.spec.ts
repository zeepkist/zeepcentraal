import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { statsHandler } from './stats'

test('stats delegates standard activity statistics', async () => {
	const userStats = mock(async () => ({
		recordStatistics: { aggregates: {} },
		records: { totalCount: 1 },
		personalBests: { totalCount: 2 },
		worldRecords: { totalCount: 3 },
		levels: { totalCount: 4 },
		votes: { totalCount: 5 },
	}))
	const { context } = createMockContext({ graphql: { userStats } })
	const { interaction, state } = createChatInteraction('stats', {
		strings: { range: 'today' },
	})
	await statsHandler(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('Player statistics')
})
