import { expect, spyOn, test } from 'bun:test'
import {
	createLiveQueryInvalidationPoller,
	type LiveQueryInvalidationStore,
} from './liveQueryInvalidationPoller'

test('live-query poller uses its injected restricted-role store and closes it on disposal', async () => {
	let reads = 0
	let closes = 0
	const firstRead = Promise.withResolvers<void>()
	const store: LiveQueryInvalidationStore = {
		async getIds() {
			reads += 1
			firstRead.resolve()
			return []
		},
		async prune() {},
		async close() {
			closes += 1
		},
	}
	const poller = createLiveQueryInvalidationPoller(
		{
			databaseUrl: 'postgres://zeepcentraal_graphql:secret@database:5432/zeepkist',
			pollMs: 60_000,
			invalidationRetentionMinutes: 60,
			databaseTimeouts: {
				connectMs: 5000,
				statementMs: 15000,
				lockMs: 3000,
				idleTransactionMs: 30000,
			},
		},
		store,
	)

	poller.start(() => {})
	await firstRead.promise
	await poller.dispose()

	expect(reads).toBe(1)
	expect(closes).toBe(1)
})

const config = {
	databaseUrl: 'postgres://unused',
	pollMs: 5,
	invalidationRetentionMinutes: 60,
	databaseTimeouts: { connectMs: 1000, statementMs: 1000, lockMs: 1000, idleTransactionMs: 1000 },
}

async function waitFor(predicate: () => boolean) {
	for (let attempt = 0; attempt < 200; attempt++) {
		if (predicate()) return
		await Bun.sleep(5)
	}
	throw new Error('Poll did not complete')
}

test('detects late lower IDs, ignores pruning, and retries failed polls', async () => {
	let visible = [100n]
	let failure = false
	let reads = 0
	let invalidations = 0
	const warning = spyOn(console, 'warn').mockImplementation(() => {})
	const poller = createLiveQueryInvalidationPoller(config, {
		async getIds() {
			reads++
			if (failure) throw new Error('offline')
			return [...visible]
		},
		async prune() {},
		async close() {},
	})
	try {
		poller.start(() => invalidations++)
		await waitFor(() => invalidations === 1)
		visible = [102n, 100n]
		await waitFor(() => invalidations === 2)
		visible = [102n, 101n, 100n]
		await waitFor(() => invalidations === 3)
		visible = [102n, 101n]
		const beforePrune = reads
		await waitFor(() => reads > beforePrune + 1)
		expect(invalidations).toBe(3)
		failure = true
		visible = [103n, ...visible]
		await waitFor(() => warning.mock.calls.length > 0)
		failure = false
		await waitFor(() => invalidations === 4)
	} finally {
		await poller.dispose()
		warning.mockRestore()
	}
})

test('bounds overflow refreshes while detecting new heads', async () => {
	let now = 0
	const clock = spyOn(Date, 'now').mockImplementation(() => now)
	let reads = 0
	let invalidations = 0
	let ids = Array.from({ length: 10_001 }, (_, index) => BigInt(20_000 - index))
	const poller = createLiveQueryInvalidationPoller(config, {
		async getIds(limit) {
			expect(limit).toBe(10_001)
			reads++
			return ids
		},
		async prune() {},
		async close() {},
	})
	try {
		poller.start(() => invalidations++)
		await waitFor(() => reads >= 3)
		expect(invalidations).toBe(1)
		now = 5000
		await waitFor(() => invalidations === 2)
		ids = [20_001n, ...ids.slice(0, 10_000)]
		await waitFor(() => invalidations === 3)
	} finally {
		await poller.dispose()
		clock.mockRestore()
	}
})

test('discards polls from a stopped generation and refreshes the initial baseline', async () => {
	const pending = Promise.withResolvers<bigint[]>()
	let reads = 0
	let invalidations = 0
	const poller = createLiveQueryInvalidationPoller(config, {
		async getIds() {
			return ++reads === 1 ? pending.promise : [101n]
		},
		async prune() {},
		async close() {},
	})
	try {
		poller.start(() => invalidations++)
		poller.stop()
		poller.start(() => invalidations++)
		pending.resolve([102n])
		await waitFor(() => reads >= 3)
		expect(invalidations).toBe(1)
	} finally {
		await poller.dispose()
	}
})
