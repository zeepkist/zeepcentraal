import { expect, mock, test } from 'bun:test'
import { createFeedEvent } from '../../test/feed-mocks'
import { createMockContext, linkedUser } from '../../test/mocks'
import { rankMessage } from './rank-message'

test('rank message renders validated changes and directions', async () => {
	const { context } = createMockContext({
		graphql: {
			usersByIds: mock(
				async () =>
					new Map([
						[7, linkedUser],
						[8, { ...linkedUser, id: 8, steamName: 'Eight' }],
					]),
			),
		},
	})
	const ranked = await rankMessage(
		createFeedEvent({
			kind: 'rank_batch',
			payload: {
				changes: [
					{ idUser: 7, previousRank: 4, rank: 2 },
					{ idUser: 8, previousRank: 2, rank: 5 },
					{ idUser: 9, previousRank: -1, rank: 6 },
					{ idUser: 10, previousRank: 7, rank: -1 },
					{ idUser: 11, previousRank: 3, rank: 3 },
					{ idUser: 'bad', previousRank: 3, rank: 2 },
				],
			},
		}),
		context,
	)
	expect(JSON.stringify(ranked)).toContain('▲')
	expect(JSON.stringify(ranked)).toContain('▼')
	expect(JSON.stringify(ranked)).toContain('Rank changes • 4 players')
	expect(JSON.stringify(ranked)).toContain('Unranked → #6')
	expect(JSON.stringify(ranked)).toContain('#7 → Unranked')
	expect(await rankMessage(createFeedEvent({ payload: null }), context)).toBeNull()
	expect(await rankMessage(createFeedEvent({ payload: { changes: [] } }), context)).toBeNull()
})
