import { expect, mock, test } from 'bun:test'
import {
	createButtonInteraction,
	createChatInteraction,
	createMockContext,
	linkedUser,
} from '../../../test/mocks'
import { handlePaginationButton } from './pagination.handler'
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

test('tournament handler paginates complete standings and preserves link buttons', async () => {
	const results = Array.from({ length: 12 }, (_, index) => ({
		rank: index + 1,
		time: 10 + index,
		points: 100 - index,
		userId: index + 1,
		user: { ...linkedUser, id: index + 1, discordId: null, steamName: `Player ${index + 1}` },
	}))
	const query = mock(async (...args: unknown[]) => {
		const variables = args[1] as { after?: unknown; now?: string }
		if (variables.now) {
			return {
				active: {
					nodes: [
						{
							id: 5,
							slug: 'week-5',
							endAt: '2026-08-08T00:00:00Z',
							level: {
								levelItems: {
									nodes: [
										{
											name: 'Fast Track',
											imageUrl: 'https://image.test/5.png',
										},
									],
								},
							},
							trackTournamentResults: { nodes: results.slice(0, 3), totalCount: 12 },
						},
					],
				},
			}
		}
		if (!variables.after) {
			return {
				tournament: {
					leaderboard: {
						edges: results.slice(0, 10).map((node) => ({ node })),
						pageInfo: { endCursor: 'cursor-10', hasNextPage: true },
					},
				},
			}
		}
		return {
			tournament: {
				leaderboard: {
					edges: results.slice(10).map((node) => ({ node })),
					pageInfo: { endCursor: 'cursor-12', hasNextPage: false },
				},
			},
		}
	})
	const usersByIds = mock(
		async (ids: number[]) =>
			new Map(
				ids.map((id) => [
					id,
					{
						...linkedUser,
						id,
						discordId: id === 12 ? 'discord-12' : null,
						steamName: `Enriched ${id}`,
					},
				]),
			),
	)
	const { context } = createMockContext({ graphql: { query, usersByIds } })
	const { interaction, state } = createChatInteraction('totw')
	await handleTournament(interaction, context, 0)
	expect(JSON.stringify(state.edit)).toContain('Enriched 1')
	expect(JSON.stringify(state.edit)).not.toContain('Enriched 12')
	expect((state.edit as { components: unknown[] }).components).toHaveLength(2)

	const next = createButtonInteraction('page:session-1:next')
	await handlePaginationButton(next.interaction, context, 'session-1', 'next')
	const updated = JSON.stringify(next.state.update)
	expect(updated).toContain('Enriched 12 (<@discord-12>)')
	expect(updated).toContain('https://image.test/5.png')
	expect(updated).toContain('Download level playlist')
	expect(updated).toContain('Page 2/2')
	expect(query.mock.calls[2]?.[1]).toMatchObject({ after: 'cursor-10' })
})
