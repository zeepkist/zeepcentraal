import { expect, mock, test } from 'bun:test'
import { displayText, expectComponentsV2 } from '../../test/components'
import { createFeedEvent } from '../../test/feed-mocks'
import { createMockContext, linkedUser } from '../../test/mocks'
import { rankMessage } from './rank-message'

test('rank message renders validated changes and directions', async () => {
	const { context } = createMockContext({
		graphql: {
			usersByIds: mock(
				async () =>
					new Map([
						[7, { ...linkedUser, userPoints: { points: 456_789 } }],
						[
							8,
							{
								...linkedUser,
								id: 8,
								steamName: 'Eight',
								userPoints: { points: 123_000 },
							},
						],
						[
							9,
							{
								...linkedUser,
								id: 9,
								steamName: 'Nine',
								userPoints: { points: 900 },
							},
						],
					]),
			),
		},
	})
	const ranked = await rankMessage(
		createFeedEvent({
			kind: 'rank_batch',
			payload: {
				changes: [
					{ idUser: 10, previousRank: 7, rank: -1 },
					{ idUser: 8, previousRank: 2, rank: 5 },
					{ idUser: 7, previousRank: 4, rank: 2 },
					{ idUser: 9, previousRank: -1, rank: 6 },
					{ idUser: 11, previousRank: 3, rank: 3 },
					{ idUser: 'bad', previousRank: 3, rank: 2 },
				],
			},
		}),
		context,
	)
	expectComponentsV2(ranked)
	expect(displayText(ranked)).toContain('<:up:1535467505831780455>')
	expect(displayText(ranked)).toContain('<:down:1535467431655637072>')
	expect(displayText(ranked)).toContain('4 players moved')
	expect(displayText(ranked)).toContain('Unranked → #6')
	expect(displayText(ranked)).toContain('#7 → Unranked')
	expect(displayText(ranked)).toContain('#2 → #5 (123,000 pts)')
	expect(displayText(ranked)).toContain('#7 → Unranked (unknown pts)')
	const text = displayText(ranked)
	expect(text.indexOf('#4 → #2')).toBeLessThan(text.indexOf('#2 → #5'))
	expect(text.indexOf('#2 → #5')).toBeLessThan(text.indexOf('Unranked → #6'))
	expect(text.indexOf('Unranked → #6')).toBeLessThan(text.indexOf('#7 → Unranked'))
	expect(await rankMessage(createFeedEvent({ payload: null }), context)).toBeNull()
	expect(await rankMessage(createFeedEvent({ payload: { changes: [] } }), context)).toBeNull()
})
