import { expect, mock, test } from 'bun:test'
import {
	createChatInteraction,
	createMockContext,
	linkedUser,
	unlinkedState,
} from '../../test/mocks'
import { zslHandler } from './zsl'

test('zsl paginates season results and appends viewer result', async () => {
	let call = 0
	const query = mock(async (..._args: unknown[]) => {
		call++
		if (call === 1) {
			return {
				viewerStanding: {
					nodes: [
						{
							userId: 9,
							position: 9,
							points: 5,
							time: 14,
							user: { ...linkedUser, id: 9 },
						},
					],
				},
				zslSeasonResults: {
					edges: [
						{
							node: {
								userId: 1,
								position: 1,
								points: 10,
								time: 12,
								user: { ...linkedUser, id: 1 },
							},
						},
					],
					pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
				},
			}
		}
		return {
			zslSeasonResults: {
				edges: [{ node: { userId: 2, position: 2, points: 8, user: null } }],
				pageInfo: { hasNextPage: false },
			},
		}
	})
	const usersByIds = mock(
		async () =>
			new Map([
				[1, { ...linkedUser, id: 1, steamName: 'First' }],
				[9, { ...linkedUser, id: 9, steamName: 'Viewer' }],
			]),
	)
	const { context } = createMockContext({ graphql: { query, usersByIds } })
	const { interaction, state } = createChatInteraction('zsl', {
		strings: { scope: 'season' },
		integers: { id: 3 },
	})
	await zslHandler(interaction, context)
	expect(query).toHaveBeenCalledTimes(2)
	expect(query.mock.calls[1]?.[1]).toMatchObject({ after: 'cursor-1' })
	expect(JSON.stringify(state.edit)).toContain('Your result')
	expect(JSON.stringify(state.edit)).toContain('Super League season 3')
})

test('zsl validates and queries round scope', async () => {
	const { context } = createMockContext()
	const missingRound = createChatInteraction('zsl', {
		strings: { scope: 'round' },
		integers: { id: 3 },
	}).interaction
	expect(zslHandler(missingRound, context)).rejects.toThrow('Round scope needs `round`.')

	const query = mock(async (..._args: unknown[]) => ({
		zslRoundResults: { edges: [], pageInfo: { hasNextPage: false } },
	}))
	const valid = createMockContext({ graphql: { query } }).context
	const { interaction, state } = createChatInteraction('zsl', {
		strings: { scope: 'round' },
		integers: { id: 3, round: 2 },
	})
	await zslHandler(interaction, valid)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ seasonId: 3, round: 2 })
	expect(JSON.stringify(state.edit)).toContain('round 2')
})

test('zsl handles level scope without linked viewer or connection', async () => {
	const query = mock(async () => ({}))
	const user = mock(async () => unlinkedState)
	const { context } = createMockContext({ backend: { user }, graphql: { query } })
	const { interaction, state } = createChatInteraction('zsl', {
		strings: { scope: 'level' },
		integers: { id: 12 },
	})
	await zslHandler(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('No results.')
	expect(JSON.stringify(state.edit)).toContain('Super League level 12')
})

test('zsl does not duplicate viewer already in results', async () => {
	const viewer = { userId: 7, position: 1, points: 10, user: linkedUser }
	const query = mock(async () => ({
		viewerStanding: { nodes: [viewer] },
		zslLevelResults: {
			edges: [{ node: viewer }],
			pageInfo: { hasNextPage: true, endCursor: null },
		},
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('zsl', {
		strings: { scope: 'level' },
		integers: { id: 4 },
	})
	await zslHandler(interaction, context)
	expect(JSON.stringify(state.edit)).not.toContain('Your result')
})
