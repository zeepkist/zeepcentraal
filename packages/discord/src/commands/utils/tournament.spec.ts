import { expect, mock, test } from 'bun:test'
import { displayText, expectComponentsV2 } from '../../../test/components'
import {
	createButtonInteraction,
	createChatInteraction,
	createMockContext,
	linkedUser,
} from '../../../test/mocks'
import { paginationHandler } from './pagination'
import { buildTournamentMessage, buildTournamentMessages, tournamentHandler } from './tournament'

test('tournament renderer includes standings, level, buttons, and stable hash', async () => {
	const query = mock(async () => ({
		weekly: {
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
						totalCount: 4,
						nodes: [
							{ rank: 1, time: 12, points: 10, userId: 7, user: linkedUser },
							{
								rank: 2,
								time: 13,
								points: 8,
								userId: 8,
								user: { ...linkedUser, steamName: 'Second' },
							},
							{
								rank: 3,
								time: 14,
								points: 6,
								userId: 9,
								user: { ...linkedUser, steamName: 'Third' },
							},
							{
								rank: 4,
								time: 15,
								points: 4,
								userId: 10,
								user: { ...linkedUser, steamName: 'Fourth' },
							},
						],
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
	expectComponentsV2(first.message)
	expect(displayText(first.message)).toContain('Enriched')
	expect(displayText(first.message)).toContain('Third')
	expect(displayText(first.message)).not.toContain('Fourth')
	expect(JSON.stringify(first.message)).toContain('Download level playlist')
})

test('tournament renderer supports finalized tournaments and missing optional data', async () => {
	const query = mock(async () => ({
		monthly: {
			nodes: [
				{
					id: 6,
					type: 1,
					slug: 'month-6',
					endAt: '2026-08-08T00:00:00Z',
					level: null,
					trackTournamentResults: { nodes: [], totalCount: 0 },
				},
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
	const { context } = createMockContext({
		graphql: { query: mock(async () => ({ monthly: { nodes: [] }, weekly: { nodes: [] } })) },
	})
	expect(buildTournamentMessage(0, context)).rejects.toThrow('No tournament found.')
})

test('tournament renderer batches both types and linked-user enrichment', async () => {
	const query = mock(async () => ({
		weekly: {
			nodes: [
				{
					id: 5,
					type: 0,
					slug: 'week-5',
					endAt: '2026-08-08T00:00:00Z',
					trackTournamentResults: {
						nodes: [{ rank: 1, time: 12, points: 10, userId: 7, user: linkedUser }],
						totalCount: 1,
					},
				},
			],
		},
		monthly: {
			nodes: [
				{
					id: 6,
					type: 1,
					slug: 'month-6',
					endAt: '2026-08-31T00:00:00Z',
					trackTournamentResults: {
						nodes: [{ rank: 1, time: 20, points: 10, userId: 8, user: null }],
						totalCount: 1,
					},
				},
			],
		},
	}))
	const usersByIds = mock(async () => new Map([[8, { ...linkedUser, id: 8 }]]))
	const { context } = createMockContext({ graphql: { query, usersByIds } })
	const snapshots = await buildTournamentMessages(context)
	expect(query).toHaveBeenCalledTimes(1)
	expect(usersByIds).toHaveBeenCalledTimes(1)
	expect(usersByIds).toHaveBeenCalledWith([7, 8])
	expect(snapshots.size).toBe(2)
	expect(displayText(snapshots.get(1)?.message)).toContain('Player Seven (<@discord-1>)')
})

test('tournament handler defers then edits reply', async () => {
	const query = mock(async () => ({
		weekly: {
			nodes: [
				{
					id: 1,
					type: 0,
					slug: 'week',
					endAt: '2026-08-08T00:00:00Z',
					trackTournamentResults: { nodes: [], totalCount: 0 },
				},
			],
		},
	}))
	const { context } = createMockContext({ graphql: { query } })
	const { interaction, state } = createChatInteraction('totw')
	await tournamentHandler(interaction, context, 0)
	expect(state.edit).toBeDefined()
})

test('tournament handler paginates standings server-side and preserves link buttons', async () => {
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
				weekly: {
					nodes: [
						{
							id: 5,
							type: 0,
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
						pageInfo: {
							endCursor: 'cursor-10',
							hasNextPage: true,
							hasPreviousPage: false,
							startCursor: 'cursor-0',
						},
						totalCount: 12,
					},
				},
			}
		}
		return {
			tournament: {
				leaderboard: {
					edges: results.slice(10).map((node) => ({ node })),
					pageInfo: {
						endCursor: 'cursor-12',
						hasNextPage: false,
						hasPreviousPage: true,
						startCursor: 'cursor-10',
					},
					totalCount: 12,
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
	await tournamentHandler(interaction, context, 0)
	expectComponentsV2(state.edit)
	expect(displayText(state.edit)).toContain('Enriched 1')
	expect(displayText(state.edit)).not.toContain('Enriched 12')
	expect((state.edit as { components: unknown[] }).components).toHaveLength(1)
	expect(query.mock.calls[1]?.[1]).toMatchObject({ first: 10 })

	const next = createButtonInteraction('page:session-1:next')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expectComponentsV2(next.state.edit)
	const updated = displayText(next.state.edit)
	expect(updated).toContain('Enriched 12 (<@discord-12>)')
	expect(JSON.stringify(next.state.edit)).toContain('https://image.test/5.png')
	expect(JSON.stringify(next.state.edit)).toContain('Download level playlist')
	expect(updated).toContain('Page 2/2')
	expect(query.mock.calls[2]?.[1]).toMatchObject({ after: 'cursor-10' })
})
