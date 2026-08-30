import { describe, expect, test } from 'bun:test'
import type { ExecutionResult } from 'graphql'
import type { Sink } from 'graphql-ws'
import { normalizeStandings, TotwLeaderboardClient } from './totwLeaderboard'

describe('TotW leaderboard subscription', () => {
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
		const leaderboard = new TotwLeaderboardClient(
			'ws://localhost',
			(error) => errors.push(error),
			client,
			1,
		)
		leaderboard.watch(6, (rows) => received.push(rows))
		expect(request?.variables).toEqual({ id: 6 })
		sinks[0]?.next({
			data: {
				trackTournament: {
					id: 6,
					slug: '2026-w33',
					leaderboard: {
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
		leaderboard.watch(7, () => {})
		expect(disposed).toBe(1)
		sinks[1]?.error(new Error('subscription failed'))
		expect(errors).toHaveLength(1)
		await Bun.sleep(5)
		expect(sinks).toHaveLength(3)
		expect(request?.variables).toEqual({ id: 7 })
		await leaderboard.close()
		expect(disposed).toBe(2)
	})
})
