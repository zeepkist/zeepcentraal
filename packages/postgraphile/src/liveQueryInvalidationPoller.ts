import postgres from 'postgres'

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
	getMaxId(): Promise<bigint>
	prune(retentionMinutes: number): Promise<void>
	close(): Promise<void>
}

export type LiveQueryInvalidationPoller = {
	start(onInvalidate: () => void): void
	stop(): void
	dispose(): Promise<void>
}

const PRUNE_EVERY_POLLS = 240

export function createLiveQueryInvalidationStore({
	databaseTimeouts,
	databaseUrl,
}: Pick<
	LiveQueryInvalidationPollerConfig,
	'databaseTimeouts' | 'databaseUrl'
>): LiveQueryInvalidationStore {
	const client = postgres(databaseUrl, {
		max: 1,
		idle_timeout: 30,
		connect_timeout: Math.max(1, Math.ceil(databaseTimeouts.connectMs / 1000)),
		connection: {
			application_name: 'zeepcentraal-postgraphile-live-query',
			statement_timeout: databaseTimeouts.statementMs,
			lock_timeout: databaseTimeouts.lockMs,
			idle_in_transaction_session_timeout: databaseTimeouts.idleTransactionMs,
		},
	})

	return {
		async getMaxId() {
			const rows = await client<{ id: string }[]>`
				select coalesce(max(id), 0)::text as id
				from public.live_query_invalidations
			`

			return BigInt(rows[0]?.id ?? '0')
		},
		async prune(retentionMinutes) {
			await client`
				delete from public.live_query_invalidations
				where created_at < now() - make_interval(mins => ${retentionMinutes})
			`
		},
		async close() {
			await client.end({ timeout: 5 })
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
	let lastSeenId: bigint | undefined
	let activePoll: Promise<void> | undefined
	let pruneCounter = 0
	let warned = false

	function getStore() {
		store ??= createLiveQueryInvalidationStore(config)
		return store
	}

	async function poll() {
		try {
			const maxId = await getStore().getMaxId()
			if (lastSeenId === undefined) {
				lastSeenId = maxId
				return
			}

			if (maxId > lastSeenId) {
				lastSeenId = maxId
				onInvalidate?.()
			}

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

		activePoll = poll().finally(() => {
			activePoll = undefined
		})
	}

	return {
		start(nextOnInvalidate) {
			onInvalidate = nextOnInvalidate
			if (interval) {
				return
			}

			runPoll()
			interval = setInterval(runPoll, config.pollMs)
		},
		stop() {
			if (!interval) {
				return
			}

			clearInterval(interval)
			interval = undefined
			lastSeenId = undefined
		},
		async dispose() {
			this.stop()
			await activePoll
			await store?.close()
		},
	}
}
