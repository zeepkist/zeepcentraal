import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { statsSurfaceHandler } from './stats-surface'

test('stats-surface delegates surface statistics', async () => {
	const userStats = mock(async () => ({ recordStatistics: { aggregates: {} } }))
	const { context } = createMockContext({ graphql: { userStats } })
	const { interaction, state } = createChatInteraction('stats-surface', {
		strings: { range: 'today' },
	})
	await statsSurfaceHandler(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('Surface statistics')
	expect(JSON.stringify(state.edit)).toContain('Airborne')
})
