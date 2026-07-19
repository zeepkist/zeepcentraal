import { expect, test } from 'bun:test'
import {
	createLiveQueryInvalidationPoller,
	type LiveQueryInvalidationStore,
} from './liveQueryInvalidationPoller'

test('live-query poller uses its injected restricted-role store and closes it on disposal', async () => {
	let reads = 0
	let closes = 0
	const firstRead = Promise.withResolvers<void>()
	const store: LiveQueryInvalidationStore = {
		async getMaxId() {
			reads += 1
			firstRead.resolve()
			return 0n
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
		},
		store,
	)

	poller.start(() => {})
	await firstRead.promise
	await poller.dispose()

	expect(reads).toBe(1)
	expect(closes).toBe(1)
})
