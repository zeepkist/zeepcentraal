import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext } from '../../test/mocks'
import { handleRandomLevel } from './random-level.handler'

test('random-level uses injected selection and minimum points', async () => {
	const query = mock(async (..._args: unknown[]) => ({
		levels: {
			edges: [
				{ node: { id: 1, xxHash: 'hash-1', levelPoints: { points: 500 } } },
				{
					node: {
						id: 2,
						xxHash: 'hash-2',
						levelItems: { nodes: [{ name: 'Chosen' }] },
						levelPoints: { points: 1500 },
					},
				},
			],
		},
	}))
	const { context } = createMockContext({ graphql: { query }, random: 0.75 })
	const { interaction, state } = createChatInteraction('random-level', {
		integers: { 'minimum-points': 1000 },
	})
	await handleRandomLevel(interaction, context)
	expect(query.mock.calls[0]?.[1]).toMatchObject({
		filter: { levelPoints: { points: { greaterThanOrEqualTo: 1000 } } },
	})
	expect(JSON.stringify(state.edit)).toContain('Chosen')
})

test('random-level uses defaults and rejects empty result', async () => {
	const query = mock(async (..._args: unknown[]) => ({ levels: { edges: [] } }))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction } = createChatInteraction('random-level')
	expect(handleRandomLevel(interaction, context)).rejects.toThrow('No public level matched.')
	expect(query.mock.calls[0]?.[1]).toMatchObject({
		filter: { levelPoints: { points: { greaterThanOrEqualTo: 0 } } },
	})
})

test('random-level renders hash and zero points fallback', async () => {
	const query = mock(async () => ({
		levels: { edges: [{ node: { id: 1, xxHash: 'hash-only' } }] },
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('random-level')
	await handleRandomLevel(interaction, context)
	expect(JSON.stringify(state.edit)).toContain('hash-only')
})
