import {
	Zc_TotwLobbyLeaderboardLiveDocument,
	type Zc_TotwLobbyLeaderboardLiveSubscription,
} from '@zeepkist/graphql/generated'
import { type ExecutionResult, print } from 'graphql'
import { createClient, type Sink } from 'graphql-ws'
import WebSocket from 'ws'
import type { TotwLeaderboardStanding } from './totwMessages'

interface SubscriptionClient {
	dispose: () => Promise<void> | void
	subscribe: <T>(
		request: { operationName: string; query: string; variables: Record<string, unknown> },
		sink: Sink<ExecutionResult<T>>,
	) => () => void
}

export class TotwLeaderboardClient {
	private readonly client: SubscriptionClient
	private disposeSubscription: (() => void) | undefined
	private retryTimer: ReturnType<typeof setTimeout> | undefined
	private generation = 0
	private closed = false

	constructor(
		url: string,
		private readonly onError: (error: unknown) => void,
		client?: SubscriptionClient,
		private readonly retryMs = 5_000,
	) {
		this.client =
			client ??
			createClient({
				url,
				webSocketImpl: WebSocket,
				lazy: true,
				keepAlive: 30_000,
				retryAttempts: Number.POSITIVE_INFINITY,
				shouldRetry: () => true,
			})
	}

	watch(tournamentId: number, onStandings: (standings: TotwLeaderboardStanding[]) => void) {
		this.closed = false
		const generation = ++this.generation
		this.disposeSubscription?.()
		this.disposeSubscription = undefined
		if (this.retryTimer) clearTimeout(this.retryTimer)
		this.retryTimer = undefined
		this.subscribe(tournamentId, onStandings, generation)
	}

	private subscribe(
		tournamentId: number,
		onStandings: (standings: TotwLeaderboardStanding[]) => void,
		generation: number,
	) {
		this.disposeSubscription = this.client.subscribe<Zc_TotwLobbyLeaderboardLiveSubscription>(
			{
				operationName: 'ZC_TotwLobbyLeaderboardLive',
				query: print(Zc_TotwLobbyLeaderboardLiveDocument),
				variables: { id: tournamentId },
			},
			{
				complete: () => this.scheduleRetry(tournamentId, onStandings, generation),
				error: (error) => {
					this.onError(error)
					this.scheduleRetry(tournamentId, onStandings, generation)
				},
				next: (result) => {
					const rows = result.data?.trackTournament?.leaderboard.nodes
					if (rows) onStandings(normalizeStandings(rows))
				},
			},
		)
	}

	private scheduleRetry(
		tournamentId: number,
		onStandings: (standings: TotwLeaderboardStanding[]) => void,
		generation: number,
	) {
		if (this.closed || generation !== this.generation || this.retryTimer) return
		this.retryTimer = setTimeout(() => {
			this.retryTimer = undefined
			if (!this.closed && generation === this.generation) {
				this.subscribe(tournamentId, onStandings, generation)
			}
		}, this.retryMs)
	}

	async close() {
		this.closed = true
		this.generation++
		if (this.retryTimer) clearTimeout(this.retryTimer)
		this.retryTimer = undefined
		this.disposeSubscription?.()
		this.disposeSubscription = undefined
		await this.client.dispose()
	}
}

export function normalizeStandings(
	rows: NonNullable<
		NonNullable<Zc_TotwLobbyLeaderboardLiveSubscription['trackTournament']>['leaderboard']
	>['nodes'],
) {
	return rows
		.filter(
			(row) =>
				Number.isSafeInteger(row.rank) &&
				row.rank > 0 &&
				Number.isSafeInteger(row.recordId) &&
				Number.isSafeInteger(row.userId) &&
				Number.isFinite(row.time) &&
				row.time >= 0,
		)
		.map(
			(row): TotwLeaderboardStanding => ({
				rank: row.rank,
				recordId: row.recordId,
				steamName: row.user?.steamName ?? null,
				time: row.time,
				userId: row.userId,
			}),
		)
		.toSorted(
			(left, right) =>
				left.rank - right.rank || left.time - right.time || left.recordId - right.recordId,
		)
		.slice(0, 6)
}
