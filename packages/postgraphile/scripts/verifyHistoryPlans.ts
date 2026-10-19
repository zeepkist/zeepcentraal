/** Opt-in synthetic plan/latency qualification. Never accepts application databases. */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { SQL } from 'bun'
import { postgraphile } from 'postgraphile'
import type { PgClientQuery, PgClientResult } from 'postgraphile/@dataplan/pg'
import { BunPgClient } from '../src/bunSqlAdaptor'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
assert.ok(databaseUrl, 'ZC_TEST_DATABASE_URL required')
const parsed = new URL(databaseUrl)
assert.equal(parsed.hostname, '127.0.0.1')
assert.equal(parsed.pathname, '/zc_optimization_test')
assert.ok(process.argv.includes('--large'), 'Pass --large to replace synthetic fixture')
const enforceP95 = process.argv.includes('--enforce-p95')
const sql = new SQL(databaseUrl, { prepare: false })
const originalQuery = BunPgClient.prototype.query
let captured: PgClientQuery | undefined
BunPgClient.prototype.query = function <TData>(query: PgClientQuery) {
	if (query.text.includes('from "public"."record_history_entry"')) captured = query
	return originalQuery.call(this, query) as Promise<PgClientResult<TData>>
}
let instance: ReturnType<typeof postgraphile> | undefined
const preset = createPostGraphilePreset({
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
})

type PlanNode = {
	'Node Type': string
	'Relation Name'?: string
	'Index Name'?: string
	'Actual Rows': number
	'Actual Loops': number
	'Temp Written Blocks'?: number
	Plans?: PlanNode[]
}
type Plan = { Plan: PlanNode; 'Execution Time': number }
function nodes(plan: PlanNode): PlanNode[] {
	return [plan, ...(plan.Plans ?? []).flatMap(nodes)]
}
function literal(value: unknown): string {
	if (value == null) return 'NULL'
	if (typeof value === 'boolean') return value ? 'true' : 'false'
	if (typeof value === 'number') {
		assert.ok(Number.isFinite(value))
		return String(value)
	}
	assert.equal(typeof value, 'string', 'Unexpected GraphQL SQL parameter')
	return `'${String(value).replaceAll("'", "''")}'`
}
function p95(values: number[]): number {
	assert.ok(values.length)
	const value = [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]
	assert.equal(typeof value, 'number')
	return value as number
}
function planValue(rows: unknown): Plan {
	assert.ok(Array.isArray(rows))
	const value: unknown = rows[0]?.['QUERY PLAN']
	const plans = typeof value === 'string' ? JSON.parse(value) : value
	assert.ok(Array.isArray(plans) && plans[0]?.Plan)
	return plans[0] as Plan
}
function orderedLatest(plan: Plan, label: string) {
	const active = nodes(plan.Plan).filter((node) => node['Actual Loops'] > 0)
	const scans = active.filter((node) => node['Relation Name'] === 'record_history_fact')
	assert.ok(
		scans.length &&
			scans.every(
				(node) =>
					node['Index Name'] ||
					(node['Node Type'] === 'Bitmap Heap Scan' &&
						node['Actual Rows'] <= 100 &&
						nodes(node).some((child) => child['Node Type'] === 'Bitmap Index Scan')),
			),
		`${label}: missing fact index scan ${JSON.stringify(scans.map((node) => ({ type: node['Node Type'], index: node['Index Name'], rows: node['Actual Rows'] })))}`,
	)
	assert.equal(plan.Plan['Temp Written Blocks'] ?? 0, 0, `${label}: temporary spill`)
	for (const node of active.filter((node) => /Sort/.test(node['Node Type']))) {
		const factInputs = nodes(node).filter(
			(child) => child['Relation Name'] === 'record_history_fact',
		)
		assert.ok(
			factInputs.every((child) => child['Actual Rows'] <= 100),
			`${label}: history-wide sort`,
		)
	}
}

try {
	if (!process.argv.includes('--reuse-fixture'))
		await sql.unsafe(
			await readFile(
				new URL(
					'../../../crates/database/tests/fixtures/history_plans.sql',
					import.meta.url,
				),
				'utf8',
			),
		)
	assert.equal(
		Number((await sql`select count(*) as n from zc_private.record_history_fact`)[0].n),
		200000,
	)
	assert.equal(
		(
			await sql`select exists(select 1 from zc_private.record_history_fact f
	 left join public.record r on r.id=f.id and r.record_eligible=f.record_eligible where r.id is null) as bad`
		)[0].bad,
		false,
	)
	const legacy = (await sql`select original_view from zc_private.history_fact_rollout`)[0]
		.original_view as string
	const legacySelect = legacy.trim().replace(/;$/, '')
	instance = postgraphile(preset)
	await instance.getSchema()
	const server = instance.createServ(elysiaGrafserv)
	const query = await readFile(
		new URL('../../graphql/documents/web/queries/recordHistory.graphql', import.meta.url),
		'utf8',
	)
	type Page = {
		edges: Array<{ cursor: string }>
		pageInfo: { endCursor: string; startCursor: string }
	}
	async function request(variables: Record<string, unknown>) {
		captured = undefined
		const response = await server.handleGraphQLRequest(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query, operationName: 'ZC_RecordHistory', variables }),
			}),
		)
		assert.ok(response)
		const result = (await response.json()) as {
			errors?: unknown
			data: { recordHistoryEntries: Page }
		}
		assert.equal(result.errors, undefined, JSON.stringify(result.errors))
		assert.ok(captured, 'Actual GraphQL SQL not captured')
		return { sql: captured, page: result.data.recordHistoryEntries }
	}
	const cases: Array<{ label: string; latest: boolean; sql: PgClientQuery }> = []
	for (const view of ['recent', 'personal-bests', 'world-records']) {
		for (const sort of [
			'DATE_CREATED_DESC',
			'LEVEL_POINTS_DESC',
			'PLAYER_DECAYED_POINTS_DESC',
		]) {
			for (const userId of [undefined, 1]) {
				const latest = sort === 'DATE_CREATED_DESC'
				const variables = {
					filter: {
						historyView: { equalTo: view },
						...(latest ? {} : { hasContribution: { equalTo: true } }),
						...(userId ? { userId: { equalTo: userId } } : {}),
					},
					orderBy: latest
						? ['DATE_CREATED_DESC', 'ID_DESC']
						: [sort, 'DATE_CREATED_DESC', 'ID_DESC'],
				}
				const label = `${view}/${sort}/${userId ?? 'all'}`
				const first = await request({ ...variables, first: 25 })
				cases.push({ label: `${label}/first`, latest, sql: first.sql })
				const next = await request({
					...variables,
					first: 25,
					after: first.page.pageInfo.endCursor,
				})
				cases.push({ label: `${label}/after`, latest, sql: next.sql })
				const previous = await request({
					...variables,
					last: 25,
					before: next.page.pageInfo.startCursor,
				})
				assert.deepEqual(previous.page.edges, first.page.edges)
				cases.push({ label: `${label}/before`, latest, sql: previous.sql })
			}
		}
	}
	const reported = await request({
		first: 25,
		after: 'WyJiYWJlOTZlZDNmIiwiMjAyNi0wOS0yN1QwMTozNDo1NC41NzExODArMDA6MDAiLDM5NzMxMjAsInBlcnNvbmFsLWJlc3RzIiwzOTczMTIwXQ==',
		filter: { historyView: { equalTo: 'personal-bests' } },
		orderBy: ['DATE_CREATED_DESC', 'ID_DESC'],
	})
	cases.push({ label: 'reported-cursor', latest: true, sql: reported.sql })
	const latencies = { legacy: [] as number[], fact: [] as number[], control: [] as number[] }
	const orders = [
		['legacy', 'fact', 'control'],
		['fact', 'control', 'legacy'],
		['control', 'legacy', 'fact'],
		['legacy', 'control', 'fact'],
		['control', 'fact', 'legacy'],
		['fact', 'legacy', 'control'],
	] as const
	let plansChecked = 0
	for (const role of ['postgres', 'zeepcentraal_graphql']) {
		for (const mode of ['force_custom_plan', 'force_generic_plan']) {
			for (const test of cases) {
				await sql.begin(async (tx) => {
					await tx.unsafe(
						`SET LOCAL ROLE ${role}; SET LOCAL plan_cache_mode=${mode}; SET LOCAL statement_timeout='15s'`,
					)
					await tx.unsafe(`PREPARE history_fact_query AS ${test.sql.text}`)
					await tx.unsafe(
						`PREPARE history_legacy_query AS ${test.sql.text.replace('"public"."record_history_entry"', `(${legacySelect})`)}`,
					)
					const args = (test.sql.values ?? []).map(literal).join(',')
					const factExecute = `EXECUTE history_fact_query${args ? `(${args})` : ''}`
					const legacyExecute = `EXECUTE history_legacy_query${args ? `(${args})` : ''}`
					try {
						assert.deepEqual(
							Array.from(await tx.unsafe(factExecute)),
							Array.from(await tx.unsafe(legacyExecute)),
							`${role}/${mode}/${test.label}: parity`,
						)
						const plan = planValue(
							await tx.unsafe(
								`EXPLAIN(ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) ${factExecute}`,
							),
						)
						if (test.latest) orderedLatest(plan, `${role}/${mode}/${test.label}`)
						plansChecked++
						// Balance execution order, discard warmups, and repeat legacy SQL as a noise control.
						if (test.latest && test.label.endsWith('/after')) {
							for (let repetition = 0; repetition < 60; repetition++) {
								for (const source of orders[repetition % orders.length] ??
									orders[0]) {
									const measured = planValue(
										await tx.unsafe(
											`EXPLAIN(ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) ${source === 'fact' ? factExecute : legacyExecute}`,
										),
									)
									if (repetition >= 12)
										latencies[source].push(measured['Execution Time'])
								}
							}
						}
					} finally {
						await tx.unsafe(
							'DEALLOCATE history_fact_query; DEALLOCATE history_legacy_query',
						)
					}
				})
			}
		}
	}
	const write = { legacy: [] as number[], fact: [] as number[], control: [] as number[] }
	const rollback = new Error('rollback write profiling')
	await assert.rejects(
		sql.begin(async (tx) => {
			const factDefinition = (
				await tx`select zc_private.history_fact_view_definition() as value`
			)[0].value as string
			for (let repetition = 0; repetition < 132; repetition++) {
				for (const source of orders[repetition % orders.length] ?? orders[0]) {
					await tx.unsafe(
						`CREATE OR REPLACE VIEW public.record_history_entry WITH (security_invoker=true) AS ${source === 'fact' ? factDefinition : legacySelect}`,
					)
					const measured = planValue(
						await tx.unsafe(
							'EXPLAIN(ANALYZE,BUFFERS,WAL,TIMING OFF,FORMAT JSON) UPDATE public.record SET time=time+0.01 WHERE id=3970001',
						),
					)
					if (repetition >= 12) write[source].push(measured['Execution Time'])
				}
			}
			throw rollback
		}),
		(error: unknown) => error === rollback,
	)
	const result = {
		facts: 200000,
		cases: cases.length,
		plansChecked,
		readP95Ms: { legacy: p95(latencies.legacy), fact: p95(latencies.fact) },
		readControlP95Ms: p95(latencies.control),
		writeP95Ms: { legacy: p95(write.legacy), fact: p95(write.fact) },
		writeControlP95Ms: p95(write.control),
	}
	console.log(JSON.stringify(result, null, 2))
	if (process.env.ZC_HISTORY_PLAN_REPORT) {
		await writeFile(
			process.env.ZC_HISTORY_PLAN_REPORT,
			JSON.stringify(
				{
					...result,
					queries: cases.map((test) => ({
						label: test.label,
						sql: test.sql.text,
						values: test.sql.values,
					})),
				},
				null,
				2,
			),
		)
	}
	if (enforceP95) {
		assert.ok(
			result.readP95Ms.fact <= result.readP95Ms.legacy * 1.1,
			'Read p95 regression exceeds 10%',
		)
		assert.ok(
			result.writeP95Ms.fact <= result.writeP95Ms.legacy * 1.1,
			'Write p95 regression exceeds 10%',
		)
	}
} finally {
	BunPgClient.prototype.query = originalQuery
	await instance?.release()
	await sql.close()
}
