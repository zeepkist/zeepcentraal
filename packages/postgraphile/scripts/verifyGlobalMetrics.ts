/** Isolated PostgreSQL fixture only. Never accepts production database names. */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { SQL } from 'bun'
import { postgraphile } from 'postgraphile'
import { printType } from 'postgraphile/graphql'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'
import { verifyHistoryFactMigration } from './historyFactMigrationChecks'
import { restoreHistoryPreparation, retireHistoryFixture } from './historyRetirementFixture'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
if (!databaseUrl) throw new Error('ZC_TEST_DATABASE_URL required')
const parsed = new URL(databaseUrl)
assert.equal(parsed.hostname, '127.0.0.1')
assert.equal(parsed.pathname, '/zc_optimization_test')
const sql = new SQL(databaseUrl, { prepare: false })
const restoreRetired = await restoreHistoryPreparation(sql)
const instance = postgraphile(
	createPostGraphilePreset({
		databaseUrl,
		allowExplain: false,
		nodeEnv: 'production',
		databasePoolMax: 2,
		databaseTimeouts: {
			connectMs: 5000,
			statementMs: 15000,
			lockMs: 3000,
			idleTransactionMs: 30000,
		},
		cacheMaxEntries: 128,
		operationPlansPerOperation: 8,
		liveQueries: { enabled: true },
	}),
)
try {
	const schema = await instance.getSchema()
	assert.ok(schema.getQueryType()?.getFields().globalMetrics)
	if (process.argv.includes('--write-schema')) {
		const path = new URL('../../graphql/schema.graphql', import.meta.url)
		let source = await readFile(path, 'utf8')
		const type = schema.getType('GlobalMetricSummary')
		assert.ok(type)
		if (source.includes('type GlobalMetricSummary {'))
			source = source.replace(/type GlobalMetricSummary \{[\s\S]*?\n\}/, printType(type))
		else source = `${source}\n${printType(type)}\n`
		for (const root of ['Query', 'Subscription']) {
			if (!new RegExp(`type ${root}[^\\{]*\\{\\s*globalMetrics:`).test(source)) {
				source = source.replace(
					new RegExp(`(type ${root}[^\\{]*\\{)`),
					'$1\n  globalMetrics: GlobalMetricSummary',
				)
			}
		}
		await writeFile(path, source)
	}
	await sql.unsafe(
		await readFile(
			new URL('../../../crates/database/tests/fixtures/global_metrics.sql', import.meta.url),
			'utf8',
		),
	)
	const expected = [4, 2, 3, 4, 2, 3, 1, 1, 1, 2, 1, 1, 2, 1, 2, 3, 4, 1, 3, 3]
	const counts = await sql`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
	assert.deepEqual(Object.values(counts[0]).slice(0, 20).map(Number), expected)
	await sql
		.begin(async (tx) => {
			await tx`update public.level_item set deleted=true where workshop_id=901`
			assert.equal(
				Number(
					(
						await tx`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
					)[0].world_records,
				),
				1,
			)
			await tx`update public.level_item set deleted=true where workshop_id=902`
			const unavailable = (
				await tx`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
			)[0]
			assert.equal(Number(unavailable.world_records), 0)
			assert.equal(Number(unavailable.personal_bests), 4)
			await tx`update public.level_item set deleted=false where workshop_id=903`
			await tx`update public.level set publicly_visible=false where id=2`
			assert.equal(
				Number(
					(
						await tx`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
					)[0].world_records,
				),
				1,
			)
			throw new Error('rollback availability fixture')
		})
		.catch((error: Error) => {
			assert.equal(error.message, 'rollback availability fixture')
		})
	await sql
		.begin(async (tx) => {
			await tx`update public."user" set banned=true where id=1`
			const banned = (
				await tx`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
			)[0]
			assert.deepEqual(
				[
					banned.players,
					banned.players_all,
					banned.ranked_players,
					banned.active_players_today,
				].map(Number),
				[2, 4, 0, 2],
			)
			throw new Error('rollback ban fixture')
		})
		.catch((error: Error) => {
			assert.equal(error.message, 'rollback ban fixture')
		})
	await sql
		.begin(async (tx) => {
			await tx`insert into public.record(id,id_user,id_level,time,game_version,mod_version,date_created) overriding system value values(6,1,1,9,'test','test','2026-09-10 10:00Z')`
			await tx`update public.personal_best_global set id_record=6 where id_user=1 and id_level=1`
			await tx`update public.world_record_global set id_record=6 where id_level=1`
			const holders = (
				await tx`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
			)[0]
			assert.deepEqual(
				[
					holders.personal_bests,
					holders.personal_bests_today,
					holders.personal_bests_month,
					holders.world_records_today,
					holders.world_records_month,
				].map(Number),
				[4, 1, 2, 0, 0],
			)
			assert.equal(
				(await tx`select zc_private.history_fact_mismatch(ARRAY[1,6]) as bad`)[0].bad,
				false,
			)
			throw new Error('rollback holder fixture')
		})
		.catch((error: Error) => {
			assert.equal(error.message, 'rollback holder fixture')
		})
	await sql
		.begin(async (tx) => {
			await tx`update public.record set date_created='2026-11-01 10:00Z' where id=1`
			await tx`update public.level_item set created_at='2026-11-01 10:00Z' where workshop_id=902`
			await tx`update public.zsl_round set event_date='2026-11-01 10:00Z' where id=1`
			const future = (
				await tx`select * from zc_private.compute_global_metrics('2026-10-18 12:00Z')`
			)[0]
			assert.deepEqual(
				[
					future.records_today,
					future.personal_bests_today,
					future.world_records_today,
					future.active_players_today,
				].map(Number),
				[1, 1, 0, 1],
			)
			throw new Error('rollback future fixture')
		})
		.catch((error: Error) => {
			assert.equal(error.message, 'rollback future fixture')
		})
	for (const [instant, dayStart, monthStart] of [
		['2026-03-29 12:00Z', '2026-03-29T00:00:00.000Z', '2026-03-01T00:00:00.000Z'],
		['2026-10-25 12:00Z', '2026-10-24T23:00:00.000Z', '2026-09-30T23:00:00.000Z'],
		['2026-11-01 00:00Z', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'],
	]) {
		const rows =
			await sql`select * from zc_private.compute_global_metrics(${instant}::timestamptz)`
		assert.equal(new Date(rows[0].day_start).toISOString(), dayStart)
		assert.equal(new Date(rows[0].month_start).toISOString(), monthStart)
	}
	const cold = await sql`select * from public.global_metrics()`
	assert.equal(String(cold[0].time_zone), 'Europe/London')
	await sql`select zc_private.refresh_global_metrics()`
	const warm = await sql`select * from public.global_metrics()`
	const stored = await sql`select as_of from zc_private.global_metrics_snapshot`
	assert.equal(String(warm[0].as_of), String(stored[0].as_of))
	await assert.rejects(
		sql.begin(async (tx) => {
			await tx.unsafe(
				`CREATE OR REPLACE FUNCTION zc_private.compute_global_metrics(p_as_of timestamptz) RETURNS public.global_metric_summary LANGUAGE plpgsql STABLE AS $$ BEGIN RAISE EXCEPTION 'compute called'; END $$`,
			)
			assert.equal(Number((await tx`select * from public.global_metrics()`)[0].records), 4)
			await tx`update zc_private.global_metrics_snapshot set as_of=statement_timestamp()-interval '61 seconds'`
			await tx`select * from public.global_metrics()`
		}),
		/compute called/,
	)
	for (const change of [
		"as_of=statement_timestamp()-interval '61 seconds'",
		"day_start=day_start-interval '1 day'",
		'semantics_version=2',
		"time_zone='UTC'",
		"as_of=statement_timestamp()+interval '1 hour'",
	]) {
		await sql.begin(async (tx) => {
			await tx.unsafe(`update zc_private.global_metrics_snapshot set ${change}`)
			assert.equal(Number((await tx`select * from public.global_metrics()`)[0].records), 4)
		})
		await sql`truncate zc_private.global_metrics_snapshot`
		await sql`select zc_private.refresh_global_metrics()`
	}
	await sql.begin(async (tx) => {
		await tx`update zc_private.global_metrics_snapshot set as_of=statement_timestamp()+interval '1 hour',records=987654`
		await tx`select zc_private.refresh_global_metrics()`
		assert.equal(
			Number((await tx`select records from zc_private.global_metrics_snapshot`)[0].records),
			987654,
		)
	})
	await sql`truncate zc_private.global_metrics_snapshot`
	await sql.begin(async (tx) => {
		await tx`insert into zc_private.global_metrics_snapshot select true,2,m.* from zc_private.compute_global_metrics(statement_timestamp()-interval '1 minute') m`
		await tx`update zc_private.global_metrics_snapshot set records=987654`
		await tx`select zc_private.refresh_global_metrics()`
		const snapshot = (
			await tx`select records,semantics_version from zc_private.global_metrics_snapshot`
		)[0]
		assert.equal(Number(snapshot.records), 987654)
		assert.equal(Number(snapshot.semantics_version), 2)
	})
	await sql`truncate zc_private.global_metrics_snapshot`
	await Promise.all(
		Array.from({ length: 4 }, () => sql`select zc_private.refresh_global_metrics()`),
	)
	await sql.begin(async (tx) => {
		await tx`set local role zeepcentraal_graphql`
		assert.equal(Number((await tx`select * from public.global_metrics()`)[0].records), 4)
		assert.equal(
			(
				await tx`select has_table_privilege(current_user,'zc_private.global_metrics_snapshot','SELECT') as allowed`
			)[0].allowed,
			false,
		)
	})
	const server = instance.createServ(elysiaGrafserv)
	const response = await server.handleGraphQLRequest(
		new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: '{ globalMetrics { records personalBests worldRecords players playersAll rankedPlayers activePlayersToday timeZone } }',
			}),
		}),
	)
	assert.ok(response)
	const result = (await response.json()) as {
		errors?: unknown
		data: { globalMetrics: Record<string, unknown> }
	}
	assert.equal(result.errors, undefined, JSON.stringify(result.errors))
	assert.equal(Number(result.data.globalMetrics.records), 4)
	assert.equal(Number(result.data.globalMetrics.worldRecords), 1)
	type HistoryPage = {
		nodes: Array<{
			id: number
			historyView: string
			time: number
			levelPoints: number | null
			playerDecayedPoints: number | null
		}>
		totalCount: number
		pageInfo: { endCursor: string | null; startCursor: string | null }
	}
	async function history(variables: Record<string, unknown>): Promise<HistoryPage> {
		const response = await server.handleGraphQLRequest(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					query: `query History($filter: RecordHistoryEntryFilter, $order: [RecordHistoryEntriesOrderBy!], $first:Int, $after:Cursor, $last:Int, $before:Cursor) {
				 recordHistoryEntries(filter:$filter,orderBy:$order,first:$first,after:$after,last:$last,before:$before) {
				 nodes { id historyView time levelPoints playerDecayedPoints } totalCount pageInfo { endCursor startCursor }
				 }
				}`,
					variables,
				}),
			}),
		)
		assert.ok(response)
		const result = (await response.json()) as {
			errors?: unknown
			data: { recordHistoryEntries: HistoryPage }
		}
		assert.equal(result.errors, undefined, JSON.stringify(result.errors))
		return result.data.recordHistoryEntries
	}
	const historyCases = []
	for (const view of ['recent', 'personal-bests', 'world-records']) {
		for (const sort of [
			'DATE_CREATED_DESC',
			'PLAYER_DECAYED_POINTS_DESC',
			'LEVEL_POINTS_DESC',
		]) {
			for (const userId of [undefined, 1]) {
				const variables = {
					filter: {
						historyView: { equalTo: view },
						...(sort === 'DATE_CREATED_DESC'
							? {}
							: { hasContribution: { equalTo: true } }),
						...(userId ? { userId: { equalTo: userId } } : {}),
					},
					order: [sort, 'DATE_CREATED_DESC', 'ID_DESC'],
				}
				const all = await history({ ...variables, first: 100 })
				const first = await history({ ...variables, first: 1 })
				historyCases.push({ variables, all, first })
			}
		}
	}
	// Keep nullable value cursors compatible even without the UI contribution filter.
	const nullableHistoryCases = []
	for (const view of ['recent', 'personal-bests', 'world-records']) {
		for (const sort of ['LEVEL_POINTS_DESC', 'PLAYER_DECAYED_POINTS_DESC']) {
			const variables = {
				filter: { historyView: { equalTo: view } },
				order: [sort, 'DATE_CREATED_DESC', 'ID_DESC'],
			}
			const first = await history({ ...variables, first: 1 })
			const last = await history({ ...variables, last: 1 })
			for (const page of [
				{ first: 100 },
				{ first: 100, after: first.pageInfo.endCursor },
				{ last: 100 },
				{ last: 100, before: last.pageInfo.startCursor },
			]) {
				const request = { ...variables, ...page }
				nullableHistoryCases.push({ request, response: await history(request) })
			}
		}
	}
	// Simulate existing rows before mirroring starts, then resume one-row batches.
	await sql`truncate zc_private.record_history_fact`
	let pendingBackfill: Promise<unknown> | undefined
	await sql.begin(async (tx) => {
		await tx`update public.record set time=9 where id=1`
		pendingBackfill = Promise.resolve(sql`select zc_private.backfill_history_fact(1)`)
		for (let attempt = 0; attempt < 100; attempt++) {
			const blocked = await sql`select exists(
			 select 1 from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()
			 and query like '%backfill_history_fact(1)%' and wait_event_type='Lock'
			) as waiting`
			if (blocked[0].waiting) return
			await Bun.sleep(10)
		}
		assert.fail('Backfill did not wait for concurrent history writer')
	})
	await pendingBackfill
	assert.equal(
		Number((await sql`select time from zc_private.record_history_fact where id=1`)[0].time),
		9,
	)
	await sql`update public.record set time=10 where id=1`
	while (Number((await sql`select zc_private.backfill_history_fact(1) as n`)[0].n) > 0) {}
	while (Number((await sql`select zc_private.verify_history_fact(1) as n`)[0].n) > 0) {}
	await assert.rejects(sql`select zc_private.cutover_history_fact(false,true)`, /Paused writers/)
	await assert.rejects(
		sql.begin(async (tx) => {
			await tx`update zc_private.record_history_fact set time=time+1 where id=1`
			await tx`insert into zc_private.history_fact_dirty values(1) on conflict do nothing`
			await tx`select zc_private.verify_history_fact(10)`
		}),
		/parity failed/,
	)
	const before =
		await sql`select * from public.record_history_entry order by history_view,date_created desc,id desc`
	await verifyHistoryFactMigration(sql)
	await sql.begin(async (tx) => {
		await tx.unsafe("SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s'")
		await tx`select zc_private.cutover_history_fact(true,true)`
	})
	assert.deepEqual(
		await sql`select * from public.record_history_entry order by history_view,date_created desc,id desc`,
		before,
	)
	for (const test of nullableHistoryCases)
		assert.deepEqual(await history(test.request), test.response)
	for (const test of historyCases) {
		assert.deepEqual(await history({ ...test.variables, first: 100 }), test.all)
		if (test.first.nodes.length) {
			const after = await history({
				...test.variables,
				first: 100,
				after: test.first.pageInfo.endCursor,
			})
			assert.deepEqual(after.nodes, test.all.nodes.slice(1))
			const last = await history({ ...test.variables, last: 1 })
			assert.deepEqual(last.nodes, test.all.nodes.slice(-1))
			const before = await history({
				...test.variables,
				last: 1,
				before: last.pageInfo.startCursor,
			})
			assert.deepEqual(before.nodes, test.all.nodes.slice(-2, -1))
		}
	}
	await sql`update public.record set time=9 where id=1`
	const eligibilityRollback = new Error('rollback history eligibility check')
	await assert.rejects(
		sql.begin(async (tx) => {
			await tx`update zc_private.record_validation set status='fail' where id_record=1`
			await tx`set local role zeepcentraal_graphql`
			assert.equal(
				Number(
					(await tx`select count(*) as n from public.record_history_entry where id=1`)[0]
						.n,
				),
				0,
			)
			await tx`reset role`
			assert.equal(
				(await tx`select zc_private.history_fact_mismatch(ARRAY[1]) as bad`)[0].bad,
				false,
			)
			throw eligibilityRollback
		}),
		(error: unknown) => error === eligibilityRollback,
	)
	assert.equal(
		(await sql`select zc_private.history_fact_mismatch(ARRAY[1,2,3,4,5]) as bad`)[0].bad,
		false,
	)
	await sql.begin(async (tx) => {
		await tx`set local role zeepcentraal_graphql`
		assert.equal(
			Number(
				(await tx`select count(*) as n from public.record_history_entry where id=5`)[0].n,
			),
			0,
		)
	})
	await sql`select zc_private.rollback_history_fact()`
	await sql`select zc_private.sync_record_history_records(ARRAY[1])`
	const tuple = (
		await sql`select xmin::text as version from zc_private.record_history_index where id=1 and history_view='recent'`
	)[0].version
	await sql`select zc_private.sync_record_history_records(ARRAY[1])`
	assert.equal(
		(
			await sql`select xmin::text as version from zc_private.record_history_index where id=1 and history_view='recent'`
		)[0].version,
		tuple,
	)
	const upsert = await readFile(
		new URL(
			'../../../crates/database/src/queries/upsert_record_statistics.sql',
			import.meta.url,
		),
		'utf8',
	)
	const payload = JSON.stringify({
		ghost_version: 8,
		distance: 42,
		time_on_unknown: 3,
		distance_on_unknown: 7,
	})
	await sql.unsafe(upsert, [1, payload])
	const statistic = (
		await sql`select xmin::text as version,date_created from public.record_statistic where id_record=1`
	)[0]
	await sql.unsafe(upsert, [1, payload])
	assert.equal(
		(await sql`select xmin::text as version from public.record_statistic where id_record=1`)[0]
			.version,
		statistic.version,
	)
	await sql.unsafe(upsert, [1, JSON.stringify({ ghost_version: 8, distance: 43 })])
	const replaced = (
		await sql`select date_created,time_on_unknown from public.record_statistic where id_record=1`
	)[0]
	assert.equal(String(replaced.date_created), String(statistic.date_created))
	assert.equal(replaced.time_on_unknown, null)
	await sql.unsafe(upsert, [5, payload])
	assert.equal(
		(await sql`select record_eligible from public.record_statistic where id_record=5`)[0]
			.record_eligible,
		false,
	)
	if (restoreRetired) await retireHistoryFixture(sql)
	console.log(
		'20 metrics, DST, freshness, no-scan warm reads, roles, GraphQL, history cutover/rollback, and guarded writes passed',
	)
	if (process.argv.includes('--serve')) {
		let metricRequests = 0
		Bun.serve({
			hostname: '127.0.0.1',
			port: 55440,
			async fetch(request) {
				const path = new URL(request.url).pathname
				const headers = {
					'access-control-allow-origin':
						request.headers.get('origin') ?? 'http://127.0.0.1:4174',
					'access-control-allow-credentials': 'true',
					'access-control-allow-headers': 'content-type',
				}
				if (request.method === 'OPTIONS') return new Response(null, { headers })
				if (path === '/healthz') return new Response('ok')
				if (path === '/__test/requests') return Response.json({ metricRequests })
				if (path === '/__test/advance' && request.method === 'POST') {
					await sql`insert into public.record(id,id_user,id_level,time,game_version,mod_version) overriding system value select max(id)+1,1,1,20,'test','test' from public.record`
					await sql`select zc_private.refresh_global_metrics()`
					return new Response('ok')
				}
				if (path !== '/') return Response.json({}, { status: 401, headers })
				const body = (await request.clone().json()) as { query?: string }
				if (body.query?.includes('globalMetrics')) metricRequests += 1
				const response = await server.handleGraphQLRequest(request)
				if (!response) return new Response('Not found', { status: 404, headers })
				for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
				return response
			},
		})
		console.log('Isolated GraphQL fixture ready on 127.0.0.1:55440')
		await new Promise(() => {})
	}
} finally {
	await instance.release()
	await sql.close()
}
