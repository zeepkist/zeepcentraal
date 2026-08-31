import { describe, expect, test } from 'bun:test'
import { type ExecutionResult, GraphQLError } from 'graphql'
import type { Sink } from 'graphql-ws'
import {
	normalizePlayerContext,
	normalizeStandings,
	TrackTournamentLeaderboardHub,
} from './trackTournamentLeaderboard'

describe('track tournament leaderboard subscriptions', () => {
	test('normalizes, sorts, bounds, and preserves nullable names', () => {
		const rows = Array.from({ length: 8 }, (_, index) => ({
			rank: 8 - index,
			recordId: 100 + index,
			time: 70 - index,
			tournamentId: 1,
			user: index === 0 ? null : { steamName: `Player ${index}` },
			userId: 200 + index,
		}))
		const normalized = normalizeStandings(rows)
		expect(normalized).toHaveLength(6)
		expect(normalized.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6])
		expect(normalized[0]?.steamName).toBe('Player 7')
	})

	test('subscribes by tournament and forwards valid standings', async () => {
		let request: { variables: Record<string, unknown> } | undefined
		const sinks: Array<Sink<ExecutionResult<unknown>>> = []
		let disposed = 0
		const client = {
			dispose: async () => {},
			subscribe: <T>(nextRequest: typeof request, nextSink: Sink<ExecutionResult<T>>) => {
				request = nextRequest
				sinks.push(nextSink as Sink<ExecutionResult<unknown>>)
				return () => disposed++
			},
		}
		const errors: unknown[] = []
		const received: unknown[] = []
		const leaderboard = new TrackTournamentLeaderboardHub(
			'ws://localhost',
			(error) => errors.push(error),
			client,
			1,
		)
		leaderboard.watch('totw', 6, (rows) => received.push(rows))
		expect(request?.variables).toEqual({ id: 6 })
		sinks[0]?.next({
			data: {
				trackTournament: {
					id: 6,
					slug: '2026-w33',
					leaderboard: {
						totalCount: 14,
						nodes: [
							{
								rank: 1,
								recordId: 1,
								time: 60,
								tournamentId: 6,
								user: { steamName: 'Winner' },
								userId: 2,
							},
						],
					},
				},
			},
		})
		expect(received).toHaveLength(1)
		expect(received[0]).toEqual({
			entries: 14,
			standings: [
				{
					rank: 1,
					recordId: 1,
					steamName: 'Winner',
					time: 60,
					userId: 2,
				},
			],
		})
		leaderboard.watch('totw', 7, () => {})
		expect(disposed).toBe(1)
		sinks[1]?.error(new Error('subscription failed'))
		expect(errors).toHaveLength(1)
		await Bun.sleep(5)
		expect(sinks).toHaveLength(3)
		expect(request?.variables).toEqual({ id: 7 })
		await leaderboard.close()
		expect(disposed).toBe(2)
		leaderboard.watch('totm', 8, () => {})
		expect(sinks).toHaveLength(3)
	})

	test('normalizes missing, stale, recent, standing, and nullable version contexts', () => {
		expect(
			normalizePlayerContext({
				user: null,
				versions: { nodes: [{ minimum: ' 1.17.3 ' }] },
			}),
		).toEqual({
			minimumGtrVersion: '1.17.3',
			recentRecord: false,
			standing: undefined,
			userExists: false,
		})
		expect(
			normalizePlayerContext({
				user: {
					id: 2,
					recentRecords: { totalCount: 0 },
					standing: { nodes: [] },
				},
				versions: { nodes: [{ minimum: null }] },
			}),
		).toEqual({
			minimumGtrVersion: null,
			recentRecord: false,
			standing: undefined,
			userExists: true,
		})
		expect(
			normalizePlayerContext({
				user: {
					id: 2,
					recentRecords: { totalCount: 1 },
					standing: { nodes: [{ rank: 5, time: 34.234 }] },
				},
				versions: null,
			}),
		).toEqual({
			minimumGtrVersion: null,
			recentRecord: true,
			standing: { rank: 5, time: 34.234 },
			userExists: true,
		})
	})

	test('queries player context with bounded variables and handles execution errors', async () => {
		let request: { operationName?: string; variables: Record<string, unknown> } | undefined
		let sink: Sink<ExecutionResult<unknown>> | undefined
		let disposed = 0
		const client = {
			dispose: async () => {},
			subscribe: <T>(
				nextRequest: NonNullable<typeof request>,
				nextSink: Sink<ExecutionResult<T>>,
			) => {
				request = nextRequest
				sink = nextSink as Sink<ExecutionResult<unknown>>
				return () => disposed++
			},
		}
		const leaderboard = new TrackTournamentLeaderboardHub('ws://localhost', () => {}, client)
		const result = leaderboard.lookupPlayerContext(
			7,
			76561198000000042n,
			'2026-08-01T00:00:00.000Z',
		)
		expect(request).toMatchObject({
			operationName: 'ZC_TrackTournamentLobbyPlayerContext',
			variables: {
				recentSince: '2026-08-01T00:00:00.000Z',
				steamId: '76561198000000042',
				tournamentId: 7,
			},
		})
		sink?.next({
			data: {
				user: null,
				versions: { nodes: [{ minimum: '1.17.3' }] },
			},
			errors: [new GraphQLError('denied')],
		})
		expect(await result).toEqual({
			minimumGtrVersion: '1.17.3',
			recentRecord: false,
			userExists: false,
		})
		expect(disposed).toBe(1)
		await leaderboard.close()
	})

	test('times out player lookup and cancels pending lookup during shutdown', async () => {
		const sinks: Array<Sink<ExecutionResult<unknown>>> = []
		let disposed = 0
		const client = {
			dispose: async () => {},
			subscribe: <T>(
				_request: {
					operationName: string
					query: string
					variables: Record<string, unknown>
				},
				sink: Sink<ExecutionResult<T>>,
			) => {
				sinks.push(sink as Sink<ExecutionResult<unknown>>)
				return () => disposed++
			},
		}
		const leaderboard = new TrackTournamentLeaderboardHub('ws://localhost', () => {}, client)
		await expect(leaderboard.lookupPlayerContext(1, 1n, 'cutoff', 1)).rejects.toThrow(
			'Tournament player context query timed out',
		)
		const pending = leaderboard.lookupPlayerContext(1, 2n, 'cutoff')
		await leaderboard.close()
		await expect(pending).rejects.toThrow('Tournament leaderboard hub is closed')
		expect(sinks).toHaveLength(2)
		expect(disposed).toBe(2)
	})
})
