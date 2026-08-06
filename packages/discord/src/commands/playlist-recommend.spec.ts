import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext, unlinkedState } from '../../test/mocks'
import { playlistRecommendHandler } from './playlist-recommend'

test('playlist-recommend filters, sorts, and resolves improvement levels', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		userPointContributions: {
			edges: [
				{ node: { levelPoints: 800, playerDecayedPoints: 600, record: { levelId: 2 } } },
				{ node: { levelPoints: 1000, playerDecayedPoints: 700, record: { levelId: 1 } } },
				{ node: { levelPoints: 500, playerDecayedPoints: 450, record: { levelId: 3 } } },
			],
		},
	}))
	const levelById = mock(async (id: number) =>
		id === 2
			? null
			: {
					id,
					xxHash: `hash-${id}`,
					levelItems: { nodes: [{ name: `Level ${id}` }] },
				},
	)
	const { context } = createMockContext({ graphql: { query, levelById } })
	const { interaction, state } = createChatInteraction('playlist-recommend', {
		integers: { count: 2 },
	})
	await playlistRecommendHandler(interaction, context)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ first: 8 })
	expect(levelById.mock.calls.map((call) => call[0])).toEqual([1, 2])
	expect(JSON.stringify(state.edit)).toContain('Level 1')
	expect(JSON.stringify(state.edit)).not.toContain('Level 2')
})

test('playlist-recommend uses default count and rejects empty results', async () => {
	const query = mock(async (..._args: unknown[]) => ({}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction } = createChatInteraction('playlist-recommend')
	expect(playlistRecommendHandler(interaction, context)).rejects.toThrow(
		'No public levels matched these filters.',
	)
	expect(query.mock.calls[0]?.[1]).toMatchObject({ first: 60 })
})

test('playlist-recommend requires linked account', async () => {
	const { context } = createMockContext({
		backend: { user: mock(async () => unlinkedState) },
	})
	const { interaction } = createChatInteraction('playlist-recommend')
	expect(playlistRecommendHandler(interaction, context)).rejects.toThrow('Link account first')
})
