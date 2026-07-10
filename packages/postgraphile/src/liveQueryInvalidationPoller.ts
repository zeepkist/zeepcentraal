type LiveQueryInvalidationPollerConfig = {
	pollMs: number
	invalidationRetentionMinutes: number
}

export type LiveQueryInvalidationPoller = {
	start(onInvalidate: () => void): void
	stop(): void
}

const PRUNE_EVERY_POLLS = 240

export function createLiveQueryInvalidationPoller(
	config: LiveQueryInvalidationPollerConfig,
): LiveQueryInvalidationPoller {
	let interval: Timer | undefined
	let onInvalidate: (() => void) | undefined
	let lastSeenId: bigint | undefined
	let pollInFlight = false
	let pruneCounter = 0
	let warned = false

	async function poll() {
		if (pollInFlight) {
			return
		}

		pollInFlight = true
		try {
			const { getMaxLiveQueryInvalidationId, pruneLiveQueryInvalidations } = await import(
				'@zeepkist/database/services'
			)
			const maxId = await getMaxLiveQueryInvalidationId()
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
				await pruneLiveQueryInvalidations(config.invalidationRetentionMinutes)
			}
		} catch (error) {
			if (!warned) {
				warned = true
				console.warn('[postgraphile] live query invalidation polling failed', error)
			}
		} finally {
			pollInFlight = false
		}
	}

	return {
		start(nextOnInvalidate) {
			onInvalidate = nextOnInvalidate
			if (interval) {
				return
			}

			void poll()
			interval = setInterval(() => void poll(), config.pollMs)
		},
		stop() {
			if (!interval) {
				return
			}

			clearInterval(interval)
			interval = undefined
			lastSeenId = undefined
		},
	}
}
