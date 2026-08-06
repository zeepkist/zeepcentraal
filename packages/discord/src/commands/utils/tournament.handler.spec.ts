import { expect, mock, test } from 'bun:test'
import { createChatInteraction, createMockContext, linkedUser } from '../../../test/mocks'
import { buildTournamentMessage, handleTournament } from './tournament.handler'

test('tournament renderer includes standings, level, buttons, and stable hash', async () => {
	const query = mock(async () => ({
		active: {
			nodes: [
				{
					id: 5,
					type: 0,
					slug: 'week-5',
					startAt: '2026-08-01T00:00:00Z',
					endAt: '2026-08-08T00:00:00Z',
					level: {
						xxHash: 'hash',
						levelItems: { nodes: [{ name: 'Level', imageUrl: 'https://image.test' }] },
					},
					trackTournamentResults: {
						totalCount: 1,
						nodes: [{ rank: 1, time: 12, points: 10, userId: 7, user: linkedUser }],
					},
				},
			],
		},
	}))
	const usersByIds = mock(async () => new Map([[7, { ...linkedUser, steamName: 'Enriched' }]]))
	const { context } = createMockContext({ graphql: { query, usersByIds } })
	const first = await buildTournamentMessage(0, context)
	const second = await buildTournamentMessage(0, context)
	expect(first.contentHash).toBe(second.contentHash)
	expect(first.tournamentType).toBe('totw')
	expect(JSON.stringify(first.message)).toContain('Enriched')
	expect(JSON.stringify(first.message)).toContain('Download level playlist')
})

test('tournament renderer supports history and missing optional data', async () => {
	const query = mock(async () => ({
		history: {
			edges: [
				{ node: { id: 6, slug: 'month-6', endAt: '2026-08-08T00:00:00Z', level: null } },
			],
		},
	}))
	const { context } = createMockContext({ graphql: { query } })
	const result = await buildTournamentMessage(1, context)
	expect(result.tournamentType).toBe('totm')
	expect(JSON.stringify(result.message)).toContain('No submitted times yet.')
	expect(JSON.stringify(result.message)).toContain('Unknown')
})

test('tournament renderer rejects absent tournament', async () => {
	const { context } = createMockContext({ graphql: { query: mock(async () => ({})) } })
	expect(buildTournamentMessage(0, context)).rejects.toThrow('No tournament found.')
})

test('tournament handler defers then edits reply', async () => {
	const query = mock(async () => ({
		active: { nodes: [{ id: 1, slug: 'week', endAt: '2026-08-08T00:00:00Z' }] },
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('totw')
	await handleTournament(interaction, context, 0)
	expect(state.edit).toBeDefined()
})
