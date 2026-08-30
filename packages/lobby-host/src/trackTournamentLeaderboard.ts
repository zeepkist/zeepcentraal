import {
	Zc_TrackTournamentLobbyLeaderboardLiveDocument,
	type Zc_TrackTournamentLobbyLeaderboardLiveSubscription,
} from '@zeepkist/graphql/generated'
import { type ExecutionResult, print } from 'graphql'
import { createClient, type Sink } from 'graphql-ws'
import WebSocket from 'ws'
import type { TrackTournamentLeaderboardStanding } from './trackTournamentMessages'

interface SubscriptionClient {
	dispose: () => Promise<void> | void
	subscribe: <T>(
		request: { operationName: string; query: string; variables: Record<string, unknown> },
		sink: Sink<ExecutionResult<T>>,
	) => () => void
}

interface WatchState {
	dispose?: () => void
	generation: number
	onStandings: (standings: TrackTournamentLeaderboardStanding[]) => void
	retryTimer?: ReturnType<typeof setTimeout>
	tournamentId: number
}

export class TrackTournamentLeaderboardHub {
	private readonly client: SubscriptionClient
	private readonly watches = new Map<string, WatchState>()
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

	watch(
		key: string,
		tournamentId: number,
		onStandings: (standings: TrackTournamentLeaderboardStanding[]) => void,
	) {
		if (this.closed) return () => {}
		this.unwatch(key)
		const state: WatchState = { generation: 1, onStandings, tournamentId }
		this.watches.set(key, state)
		this.subscribe(key, state)
		return () => this.unwatch(key)
	}

	private subscribe(key: string, state: WatchState) {
		const generation = state.generation
		state.dispose = this.client.subscribe<Zc_TrackTournamentLobbyLeaderboardLiveSubscription>(
			{
				operationName: 'ZC_TrackTournamentLobbyLeaderboardLive',
				query: print(Zc_TrackTournamentLobbyLeaderboardLiveDocument),
				variables: { id: state.tournamentId },
			},
			{
				complete: () => this.scheduleRetry(key, generation),
				error: (error) => {
					this.onError(error)
					this.scheduleRetry(key, generation)
				},
				next: (result) => {
					const rows = result.data?.trackTournament?.leaderboard.nodes
					if (rows && this.watches.get(key) === state)
						state.onStandings(normalizeStandings(rows))
				},
			},
		)
	}

	private scheduleRetry(key: string, generation: number) {
		const state = this.watches.get(key)
		if (this.closed || !state || generation !== state.generation || state.retryTimer) return
		state.retryTimer = setTimeout(() => {
			state.retryTimer = undefined
			if (!this.closed && this.watches.get(key) === state && generation === state.generation)
				this.subscribe(key, state)
		}, this.retryMs)
	}

	unwatch(key: string) {
		const state = this.watches.get(key)
		if (!state) return
		state.generation++
		if (state.retryTimer) clearTimeout(state.retryTimer)
		state.dispose?.()
		this.watches.delete(key)
	}

	async close() {
		this.closed = true
		for (const key of this.watches.keys()) this.unwatch(key)
		await this.client.dispose()
	}
}

export function normalizeStandings(
	rows: NonNullable<
		NonNullable<
			Zc_TrackTournamentLobbyLeaderboardLiveSubscription['trackTournament']
		>['leaderboard']
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
			(row): TrackTournamentLeaderboardStanding => ({
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
