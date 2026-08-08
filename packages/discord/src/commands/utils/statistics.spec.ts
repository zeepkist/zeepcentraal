import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../../test/components'
import { createChatInteraction, createMockContext, unlinkedState } from '../../../test/mocks'
import { statisticsHandler } from './statistics'

test('statistics renders aggregate values', async () => {
	const userStats = mock(async () => ({
		recordStatistics: {
			totalCount: 1,
			aggregates: {
				sum: { distance: 1200, time: 72.5 },
				average: { averageSpeed: 12.345, averageGforce: 1.234 },
				max: { maxSpeed: 55.5, maxGforce: 3.2 },
			},
		},
		records: { totalCount: 1 },
		personalBests: { totalCount: 2 },
		worldRecords: { totalCount: 3 },
		levels: { totalCount: 4 },
		votes: { totalCount: 5 },
	}))
	const { context } = createMockContext({ graphql: { userStats } })
	const { interaction, state } = createChatInteraction('stats', {
		strings: { range: 'custom', from: '2026-08-01', to: '2026-08-02' },
	})
	await statisticsHandler(interaction, context, false)
	expectComponentsV2(state.edit)
	expect(userStats).toHaveBeenCalledWith(
		7,
		'2026-08-01T00:00:00.000Z',
		'2026-08-03T00:00:00.000Z',
	)
	expect(JSON.stringify(state.edit)).toContain('1.2K m / 1:12.500')
	expect(JSON.stringify(state.edit)).toContain('55.50 km/h / 3.20 G')
})

test('surface statistics renders all measured surfaces', async () => {
	const userStats = mock(async () => ({
		recordStatistics: {
			aggregates: {
				sum: {
					distanceOnTarmac: 1,
					distanceOnGrass: 2,
					distanceOnSand: 3,
					distanceOnSoap: 4,
					distanceOnWood: 5,
					distanceOnMud: 6,
					distanceOnIce1: 7,
					distanceOnIce2: 8,
					distanceOnIce3: 9,
					distanceInAir: 10,
				},
			},
		},
	}))
	const { context } = createMockContext({ graphql: { userStats } })
	const { interaction, state } = createChatInteraction('stats-surface', {
		strings: { range: 'all-time' },
	})
	await statisticsHandler(interaction, context, true)
	expectComponentsV2(state.edit)
	expect(JSON.stringify(state.edit)).toContain('10 m')
})

test('statistics requires linked account', async () => {
	const { context } = createMockContext({
		backend: { user: mock(async () => unlinkedState) },
	})
	const { interaction } = createChatInteraction('stats', { strings: { range: 'today' } })
	expect(statisticsHandler(interaction, context, false)).rejects.toThrow('Link account first')
})
