import {
	Zc_TrackTournamentLobbyLeaderboardLiveDocument,
	type Zc_TrackTournamentLobbyLeaderboardLiveSubscription,
	Zc_TrackTournamentLobbyPlayerContextDocument,
	type Zc_TrackTournamentLobbyPlayerContextQuery,
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
	onSnapshot: (snapshot: TrackTournamentLeaderboardSnapshot) => void
	retryTimer?: ReturnType<typeof setTimeout>
	tournamentId: number
}

export interface TrackTournamentLeaderboardSnapshot {
	entries: number
	standings: TrackTournamentLeaderboardStanding[]
}

export interface TrackTournamentPlayerContext {
	minimumGtrVersion: string | null
	recentRecord: boolean
	standing?: { rank: number; time: number }
	userExists: boolean
}

export class TrackTournamentLeaderboardHub {
	private readonly client: SubscriptionClient
	private readonly pendingLookups = new Set<(error: Error) => void>()
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
		onSnapshot: (snapshot: TrackTournamentLeaderboardSnapshot) => void,
	) {
		if (this.closed) return () => {}
		this.unwatch(key)
		const state: WatchState = { generation: 1, onSnapshot, tournamentId }
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
					const leaderboard = result.data?.trackTournament?.leaderboard
					if (!leaderboard || this.watches.get(key) !== state) return
					if (
						!Number.isSafeInteger(leaderboard.totalCount) ||
						leaderboard.totalCount < 0
					) {
						this.onError(new Error('Tournament leaderboard entry count is invalid'))
						return
					}
					state.onSnapshot({
						entries: leaderboard.totalCount,
						standings: normalizeStandings(leaderboard.nodes),
					})
				},
			},
		)
	}

	lookupPlayerContext(
		tournamentId: number,
		steamId: bigint,
		recentSince: string,
		timeoutMs = 5_000,
	): Promise<TrackTournamentPlayerContext> {
		if (this.closed) return Promise.reject(new Error('Tournament leaderboard hub is closed'))
		return new Promise((resolve, reject) => {
			let dispose: (() => void) | undefined
			let finished = false
			let timer: ReturnType<typeof setTimeout> | undefined
			const finish = (
				result: { context: TrackTournamentPlayerContext } | { error: Error },
			) => {
				if (finished) return
				finished = true
				if (timer) clearTimeout(timer)
				this.pendingLookups.delete(cancel)
				dispose?.()
				if ('error' in result) reject(result.error)
				else resolve(result.context)
			}
			const cancel = (error: Error) => finish({ error })
			this.pendingLookups.add(cancel)
			timer = setTimeout(
				() => cancel(new Error('Tournament player context query timed out')),
				timeoutMs,
			)
			try {
				dispose = this.client.subscribe<Zc_TrackTournamentLobbyPlayerContextQuery>(
					{
						operationName: 'ZC_TrackTournamentLobbyPlayerContext',
						query: print(Zc_TrackTournamentLobbyPlayerContextDocument),
						variables: {
							recentSince,
							steamId: steamId.toString(),
							tournamentId,
						},
					},
					{
						complete: () =>
							cancel(
								new Error('Tournament player context query completed without data'),
							),
						error: () => cancel(new Error('Tournament player context query failed')),
						next: (result) => {
							if (!result.data) {
								cancel(
									new Error('Tournament player context query returned no data'),
								)
								return
							}
							if (result.errors?.length) {
								finish({
									context: {
										minimumGtrVersion: readMinimumGtrVersion(result.data),
										recentRecord: false,
										userExists: false,
									},
								})
								return
							}
							finish({ context: normalizePlayerContext(result.data) })
						},
					},
				)
			} catch {
				cancel(new Error('Tournament player context query failed'))
			}
			if (finished) dispose?.()
		})
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
		for (const cancel of [...this.pendingLookups])
			cancel(new Error('Tournament leaderboard hub is closed'))
		await this.client.dispose()
	}
}

export function normalizePlayerContext(
	data: Zc_TrackTournamentLobbyPlayerContextQuery,
): TrackTournamentPlayerContext {
	const standing = data.user?.standing.nodes[0]
	return {
		minimumGtrVersion: readMinimumGtrVersion(data),
		recentRecord: (data.user?.recentRecords.totalCount ?? 0) > 0,
		standing:
			standing &&
			Number.isSafeInteger(standing.rank) &&
			standing.rank > 0 &&
			Number.isFinite(standing.time) &&
			standing.time >= 0
				? { rank: standing.rank, time: standing.time }
				: undefined,
		userExists: data.user !== null,
	}
}

function readMinimumGtrVersion(data: Zc_TrackTournamentLobbyPlayerContextQuery) {
	return data.versions?.nodes[0]?.minimum?.trim() || null
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
