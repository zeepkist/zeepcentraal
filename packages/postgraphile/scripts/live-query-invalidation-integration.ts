/** Run explicitly with BUN_SQL_TEST_URL pointing at a disposable local sql_test database. */
import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { createLiveQueryInvalidationPoller } from '../src/liveQueryInvalidationPoller'

const url = process.env.BUN_SQL_TEST_URL
if (!url) throw new Error('BUN_SQL_TEST_URL must point to disposable local sql_test database')
const parsed = new URL(url)
if (
	!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
	parsed.pathname !== '/sql_test'
) {
	throw new Error('Integration checks require a disposable local sql_test database')
}

const database = new SQL(url, { max: 3 })
const marker = `poller-test-${crypto.randomUUID()}`
const allocated = Promise.withResolvers<void>()
const commit = Promise.withResolvers<void>()
let slow: Promise<unknown> | undefined
let invalidations = 0
const poller = createLiveQueryInvalidationPoller({
	databaseUrl: url,
	pollMs: 10,
	invalidationRetentionMinutes: 60,
	databaseTimeouts: {
		connectMs: 1000,
		statementMs: 5000,
		lockMs: 1000,
		idleTransactionMs: 10000,
	},
})

async function waitFor(count: number) {
	for (let attempt = 0; attempt < 500; attempt++) {
		if (invalidations >= count) return
		await Bun.sleep(10)
	}
	assert.fail(`Expected ${count} invalidations, received ${invalidations}`)
}

try {
	await database`create table if not exists public.live_query_invalidations (
		id bigserial primary key, created_at timestamptz not null default now(),
		schema_name text not null, table_name text not null, operation text not null
	)`
	poller.start(() => invalidations++)
	await waitFor(1)
	slow = database.begin(async (transaction) => {
		await transaction`insert into public.live_query_invalidations (schema_name, table_name, operation)
			values (${marker}, 'slow', 'INSERT')`
		allocated.resolve()
		await commit.promise
	})
	await Promise.race([
		allocated.promise,
		slow.then(() => assert.fail('Slow transaction ended before allocation')),
	])
	await database`insert into public.live_query_invalidations (schema_name, table_name, operation)
		values (${marker}, 'fast', 'INSERT')`
	await waitFor(2)
	commit.resolve()
	await slow
	await waitFor(3)
	console.log('Out-of-order transaction commits both invalidate live queries')
} finally {
	commit.resolve()
	await slow?.catch(() => undefined)
	await poller.dispose()
	await database`delete from public.live_query_invalidations where schema_name = ${marker}`
	await database.close()
}
