import { createSqlClient } from '@zeepkist/core/sql'

type LiveQueryInvalidationPollerConfig = {
	databaseUrl: string
	pollMs: number
	invalidationRetentionMinutes: number
	databaseTimeouts: {
		connectMs: number
		statementMs: number
		lockMs: number
		idleTransactionMs: number
	}
}

export type LiveQueryInvalidationStore = {
	getIds(limit: number): Promise<bigint[]>
	prune(retentionMinutes: number): Promise<void>
	close(): Promise<void>
}

export type LiveQueryInvalidationPoller = {
	start(onInvalidate: () => void): void
	stop(): void
	dispose(): Promise<void>
}

const PRUNE_EVERY_POLLS = 240
const MAX_TRACKED_INVALIDATIONS = 10_000
const OVERFLOW_REFRESH_MS = 5_000

export function createLiveQueryInvalidationStore({
	databaseTimeouts,
	databaseUrl,
}: Pick<
	LiveQueryInvalidationPollerConfig,
	'databaseTimeouts' | 'databaseUrl'
>): LiveQueryInvalidationStore {
	const client = createSqlClient(databaseUrl, {
		max: 1,
		idleTimeout: 30,
		connectionTimeout: Math.max(1, Math.ceil(databaseTimeouts.connectMs / 1000)),
		connection: {
			application_name: 'zeepcentraal-postgraphile-live-query',
			statement_timeout: databaseTimeouts.statementMs,
			lock_timeout: databaseTimeouts.lockMs,
			idle_in_transaction_session_timeout: databaseTimeouts.idleTransactionMs,
		},
	})

	return {
		async getIds(limit) {
			const rows = await client<{ id: string }[]>`
				select id::text as id
				from public.live_query_invalidations
				order by live_query_invalidations.id desc
				limit ${limit}
			`

			return rows.map((row) => BigInt(row.id))
		},
		async prune(retentionMinutes) {
			await client`
				delete from public.live_query_invalidations
				where created_at < now() - make_interval(mins => ${retentionMinutes})
			`
		},
		async close() {
			await client.close({ timeout: 5 })
		},
	}
}

export function createLiveQueryInvalidationPoller(
	config: LiveQueryInvalidationPollerConfig,
	providedStore?: LiveQueryInvalidationStore,
): LiveQueryInvalidationPoller {
	let store = providedStore
	let interval: Timer | undefined
	let onInvalidate: (() => void) | undefined
	let seenIds: Set<bigint> | undefined
	let lastRefreshAt = 0
	let generation = 0
	let activePoll: Promise<void> | undefined
	let pruneCounter = 0
	let warned = false

	function getStore() {
		store ??= createLiveQueryInvalidationStore(config)
		return store
	}

	async function poll(currentGeneration: number) {
		try {
			const ids = await getStore().getIds(MAX_TRACKED_INVALIDATIONS + 1)
			if (generation !== currentGeneration) return
			const overflow = ids.length > MAX_TRACKED_INVALIDATIONS
			const nextSeenIds = new Set(ids.slice(0, MAX_TRACKED_INVALIDATIONS))
			// Sequence allocation order is not commit order. Keep the visible set, not a watermark.
			// Overflow falls back to a bounded refresh interval for commits outside the tracked set.
			if (
				!seenIds ||
				[...nextSeenIds].some((id) => !seenIds?.has(id)) ||
				(overflow && Date.now() - lastRefreshAt >= OVERFLOW_REFRESH_MS)
			) {
				lastRefreshAt = Date.now()
				onInvalidate?.()
			}
			seenIds = nextSeenIds
			warned = false

			pruneCounter += 1
			if (pruneCounter >= PRUNE_EVERY_POLLS) {
				pruneCounter = 0
				await getStore().prune(config.invalidationRetentionMinutes)
			}
		} catch (error) {
			if (!warned) {
				warned = true
				console.warn('[postgraphile] live query invalidation polling failed', error)
			}
		}
	}

	function runPoll() {
		if (activePoll) {
			return
		}

		activePoll = poll(generation).finally(() => {
			activePoll = undefined
		})
	}

	return {
		start(nextOnInvalidate) {
			onInvalidate = nextOnInvalidate
			if (interval) {
				return
			}
			generation += 1

			runPoll()
			interval = setInterval(runPoll, config.pollMs)
		},
		stop() {
			if (!interval) {
				return
			}

			clearInterval(interval)
			interval = undefined
			generation += 1
			seenIds = undefined
		},
		async dispose() {
			this.stop()
			await activePoll
			await store?.close()
		},
	}
}
