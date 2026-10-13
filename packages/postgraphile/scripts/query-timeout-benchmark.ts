/** Explicit isolated benchmark. Never changes production data or shared role credentials. */
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { parsePostgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { SQL } from 'bun'
import { postgraphile } from 'postgraphile'
import { printSchema } from 'postgraphile/graphql'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'
import { loadOperationCatalog, printOperation } from './utils/webGraphqlSmoke'

const url = process.env.ZC_TEST_DATABASE_URL
if (!url) throw new Error('ZC_TEST_DATABASE_URL must name isolated flag benchmark database')
const parsed = new URL(url)
if (
	parsed.hostname !== '127.0.0.1' ||
	parsed.pathname !== '/record_eligibility_flags_benchmark_test'
) {
	throw new Error('Isolated local flag benchmark database required')
}
const root = new URL('../../../', import.meta.url)
const admin = new SQL(url, { max: 1, idleTimeout: 0 })
const config = parsePostgraphileConfig({
	...process.env,
	NODE_ENV: 'production',
	POSTGRAPHILE_DATABASE_URL: url,
	POSTGRAPHILE_SUPERUSER_DATABASE_URL: undefined,
	POSTGRAPHILE_LIVE_QUERIES: 'false',
})
const preset = createPostGraphilePreset(config)
// SET ROLE applies within every request transaction, even though schema gather uses admin.
preset.grafast = { ...preset.grafast, context: { bunPgSettings: { role: 'zeepcentraal_graphql' } } }
let handler: ReturnType<typeof postgraphile> | undefined
try {
	// Synthetic clone lacks web-query grants used by the production schema.
	await admin.unsafe(
		'GRANT USAGE ON SCHEMA public,zc_private TO zeepcentraal_graphql; GRANT SELECT ON ALL TABLES IN SCHEMA public TO zeepcentraal_graphql; GRANT SELECT ON zc_private.record_history_index TO zeepcentraal_graphql;',
	)
	if (process.argv.includes('--prepare')) {
		const flags = await admin.unsafe(
			"SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='record' AND column_name='record_eligible'",
		)
		assert.equal(flags.length, 0, 'Prepare requires pre-flag synthetic schema')
		const count = await admin.unsafe('SELECT count(*)::integer AS count FROM public.record')
		assert.equal(
			count[0]?.count,
			3929757,
			'Requires existing synthetic eligibility benchmark fixture',
		)
		await admin.begin(async (transaction) => {
			await transaction.unsafe(
				await Bun.file(
					new URL(
						'crates/database/tests/fixtures/record_eligibility_flags_benchmark.sql',
						root,
					),
				).text(),
			)
			const counts = await transaction.unsafe(
				"SELECT 1 FROM information_schema.columns WHERE table_name='user_points' AND column_name='personal_bests'",
			)
			if (!counts.length)
				await transaction.unsafe(
					await Bun.file(
						new URL(
							'crates/database/migrations/20261013010000_available_record_counts/up.sql',
							root,
						),
					).text(),
				)
			await transaction.unsafe(
				await Bun.file(
					new URL(
						'crates/database/migrations/20261013020000_persist_record_eligibility/up.sql',
						root,
					),
				).text(),
			)
		})
		// Permit index-only scans after the synthetic backfill; no production maintenance occurs.
		for (const table of ['record', 'record_statistic', 'level']) {
			await admin.unsafe(`VACUUM (ANALYZE) public.${table}`)
		}
	}
	handler = postgraphile(preset)
	const schema = await handler.getSchema()
	assert(
		!/record_?eligible|eligibility_?fkey|eligibility_?identity/i.test(printSchema(schema)),
		'Eligibility internals leaked into GraphQL schema',
	)
	const server = handler.createServ(elysiaGrafserv)
	const catalog = await loadOperationCatalog(
		fileURLToPath(new URL('packages/graphql/documents/web/', root)),
	)
	const metrics = { daySince: '2026-10-12T12:00:00Z', monthSince: '2026-09-30T23:00:00Z' }
	const viewer = { viewerId: 0, includeViewer: false }
	const probes = [
		{
			name: 'sitemap maximum IDs',
			operation: 'ZC_SitemapMaxIds',
			variables: { now: '2026-10-13T12:00:00Z' },
			budget: 1000,
		},
		{
			name: 'sitemap records page 2689',
			operation: 'ZC_SitemapRecordsPage',
			variables: { startId: 2689001, endId: 2690001 },
			budget: 1000,
		},
		{
			name: 'dashboard Today',
			operation: 'ZC_DashboardCritical',
			variables: { ...metrics, ...viewer, now: '2026-10-13T12:00:00Z' },
			budget: 5000,
		},
		{
			name: 'dashboard statistics',
			operation: 'ZC_DashboardStatistics',
			variables: metrics,
			budget: 5000,
		},
		{
			name: 'hot levels 7 days',
			operation: 'ZC_DashboardHotLevels',
			variables: { ...viewer, since: '2026-10-06T12:00:00Z' },
			budget: 5000,
		},
		{
			name: 'hot levels 30 days',
			operation: 'ZC_DashboardHotLevels',
			variables: { ...viewer, since: '2026-09-13T12:00:00Z' },
			budget: 5000,
		},
	]
	async function execute(probe: (typeof probes)[number], enforceBudget = true) {
		const start = performance.now()
		const response = await server.handleGraphQLRequest(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
			}),
			{
				query: printOperation(catalog, probe.operation),
				variables: probe.variables,
			},
		)
		assert(response?.ok, `${probe.name} HTTP error`)
		const body = (await response.json()) as {
			data?: Record<string, unknown>
			errors?: unknown[]
		}
		assert(!body.errors?.length, JSON.stringify(body.errors))
		assert(body.data, `${probe.name} missing data`)
		if (probe.operation === 'ZC_DashboardHotLevels') {
			assert.equal(
				(body.data.levels as { nodes: unknown[] }).nodes.length,
				6,
				'Hot card fragments must execute',
			)
		}
		if (probe.operation === 'ZC_DashboardCritical') {
			assert.equal(
				(body.data.records as { totalCount: number }).totalCount,
				3303371,
				'GraphQL must run under restricted eligibility RLS',
			)
		}
		const elapsedMs = Math.round(performance.now() - start)
		console.log(JSON.stringify({ name: probe.name, elapsedMs, budgetMs: probe.budget }))
		if (enforceBudget) assert(elapsedMs < probe.budget, `${probe.name} exceeds latency budget`)
	}
	for (const probe of probes) await execute(probe)
	// Same operations overlap as they do during dashboard loading. Each stays below web deadline.
	await Promise.all(probes.slice(2).map((probe) => execute({ ...probe, budget: 10000 })))
	await admin.begin('read only', async (transaction) => {
		await transaction.unsafe('SET LOCAL ROLE zeepcentraal_graphql')
		for (const query of [
			'SELECT count(*) FROM public.record',
			'SELECT sum(distance) FROM public.record_statistic',
			"SELECT id FROM public.hot_levels_since('2026-10-06T12:00:00Z') LIMIT 6",
		]) {
			const rows = await transaction.unsafe(`EXPLAIN (ANALYZE,BUFFERS) ${query}`)
			const plan = rows.map((row: Record<string, string>) => row['QUERY PLAN']).join('\n')
			assert(!plan.includes('record_validation'), 'Read-time validation lookup remains')
			console.log(plan)
		}
	})
} finally {
	await handler?.release()
	await admin.close()
}
