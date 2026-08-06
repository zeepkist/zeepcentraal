import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { handleStatsSurface } from './stats-surface.handler'

test('stats-surface delegates surface statistics', async () => {
	const userStats = mock(async () => ({ recordStatistics: { aggregates: {} } }))
	const { context } = createMockContext({ graphql: { userStats } })
	const { interaction, state } = createChatInteraction('stats-surface', {
		strings: { range: 'today' },
	})
	await handleStatsSurface(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('Surface statistics')
	expect(JSON.stringify(state.edit)).toContain('Airborne')
})
