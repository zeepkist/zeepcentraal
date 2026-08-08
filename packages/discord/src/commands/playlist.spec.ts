import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createChatInteraction, createMockContext, unlinkedState } from '../../test/mocks'
import { playlistHandler } from './playlist'

const level = {
	id: 1,
	xxHash: 'level-hash',
	levelItems: {
		nodes: [{ name: 'Level One', fileUid: 'uid-1', fileAuthor: 'Author', workshopId: '100' }],
	},
	levelPoints: { points: 1000, rating: 4 },
}

test.each([
	['points', 'LEVEL_POINTS_POINTS_DESC'],
	['records', 'RECORDS_COUNT_DESC'],
] as const)('playlist queries %s ordering', async (sort, orderBy) => {
	const query = mock(async (..._args: unknown[]) => ({
		levels: { edges: [{ node: level }, { node: { ...level, id: 2, xxHash: 'second' } }] },
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('playlist', {
		integers: { count: 1 },
		strings: { sort },
	})
	await playlistHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ first: 1, orderBy: [orderBy, 'ID_ASC'] })
	expect(JSON.stringify(state.edit)).toContain('ZeepCentraal Top Levels')
	expect(JSON.stringify(state.edit)).not.toContain('second')
})

test('playlist applies linked-player and record filters', async () => {
	const query = mock(async (..._args: unknown[]) => ({ levels: { edges: [{ node: level }] } }))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('playlist', {
		integers: { count: 5 },
		strings: { sort: 'points', name: 'My Picks' },
		booleans: { 'without-wr': true, 'without-pb': true, 'no-records': true },
	})
	await playlistHandler(interaction, context)
	expectComponentsV2(state.edit)
	const variables = query.mock.calls[0]?.[1] as { filter: Record<string, unknown> }
	expect(variables.filter).toMatchObject({
		recordsExist: false,
		personalBestGlobals: { none: { userId: { equalTo: 7 } } },
	})
	expect(variables.filter.or).toBeArray()
	expect(JSON.stringify(state.edit)).toContain('without-wr, without-pb, no-records')
})

test.each([
	['created', 'CREATED_AT_DESC'],
	['updated', 'UPDATED_AT_DESC'],
] as const)('playlist queries recent workshop items by %s', async (sort, orderBy) => {
	const recentWorkshopLevels = mock(async (..._args: unknown[]) => ({
		levelItems: {
			nodes: [
				{ ...level.levelItems.nodes[0], level },
				{ ...level.levelItems.nodes[0], name: 'Removed', level: null },
			],
		},
	}))
	const { context } = createMockContext({ graphql: { recentWorkshopLevels } })
	const { interaction, state } = createChatInteraction('playlist', {
		integers: { count: 5 },
		strings: { sort },
	})
	await playlistHandler(interaction, context)
	expectComponentsV2(state.edit)
	expect(recentWorkshopLevels.mock.calls[0]?.[1]).toBe(orderBy)
	expect(JSON.stringify(state.edit)).toContain('Level One')
	expect(JSON.stringify(state.edit)).not.toContain('Removed')
})

test('playlist queries popularity over trailing 30 days', async () => {
	const query = mock(async (..._args: unknown[]) => ({ levels: { edges: [{ node: level }] } }))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction } = createChatInteraction('playlist', {
		integers: { count: 5 },
		strings: { sort: 'popularity' },
	})
	await playlistHandler(interaction, context)
	expect(query.mock.calls[0]?.[1]).toMatchObject({
		first: 20,
		since: '2026-07-07T12:00:00.000Z',
	})
})

test('playlist requires link for personal filters', async () => {
	const { context } = createMockContext({
		backend: { user: mock(async () => unlinkedState) },
	})
	const { interaction } = createChatInteraction('playlist', {
		integers: { count: 5 },
		strings: { sort: 'points' },
		booleans: { 'without-wr': true },
	})
	expect(playlistHandler(interaction, context)).rejects.toThrow('Link account first')
})
