import assert from 'node:assert/strict'
import { postgraphile } from 'postgraphile'
import { print } from 'postgraphile/graphql'
import {
	Zc_DashboardStatisticsDocument,
	Zc_DashboardTelemetrySummaryDocument,
} from '../../graphql/src/generated/graphql'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
assert.ok(databaseUrl, 'ZC_TEST_DATABASE_URL must identify a disposable telemetry fixture')
const url = new URL(databaseUrl)
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.pathname, '/zc_telemetry_summary_test')
assert.equal(url.username, 'zeepcentraal_graphql')

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
			idleTransactionMs: 15000,
		},
		cacheMaxEntries: 128,
		operationPlansPerOperation: 8,
		liveQueries: { enabled: false },
	}),
)
const server = instance.createServ(elysiaGrafserv)

async function execute(query: string, variables: Record<string, string | number>) {
	const response = await server.handleGraphQLRequest(
		new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query, variables }),
		}),
	)
	assert.ok(response)
	const result = (await response.json()) as { data?: Record<string, unknown>; errors?: unknown }
	assert.equal(result.errors, undefined, JSON.stringify(result.errors))
	assert.ok(result.data)
	return result.data
}

async function compare(
	field: string,
	baseline: string,
	candidate: string,
	variables: Record<string, string | number>,
) {
	const elapsed = { baseline: [] as number[], candidate: [] as number[] }
	for (let attempt = 0; attempt < 21; attempt += 1) {
		const started = performance.now()
		const expected = await execute(baseline, variables)
		const baselineTime = performance.now() - started
		const candidateStarted = performance.now()
		const result = await execute(candidate, variables)
		const candidateTime = performance.now() - candidateStarted
		const summary = result[field]
		assert.equal(typeof summary, 'string')
		assert.deepEqual(JSON.parse(summary as string), expected)
		if (attempt > 0) {
			elapsed.baseline.push(baselineTime)
			elapsed.candidate.push(candidateTime)
		}
	}
	const p95 = (values: number[]) => values.toSorted((a, b) => a - b)[18]?.toFixed(2)
	console.log(field, 'p95 ms', p95(elapsed.baseline), 'to', p95(elapsed.candidate))
}

try {
	const dashboard = print(Zc_DashboardStatisticsDocument)
	const summary = print(Zc_DashboardTelemetrySummaryDocument)
	await compare('dashboardTelemetrySummary', dashboard, summary, {
		daySince: '2026-11-21T00:00:00Z',
		monthSince: '2026-11-01T00:00:00Z',
	})
	await compare('dashboardTelemetrySummary', dashboard, summary, {
		daySince: '2030-01-01T00:00:00Z',
		monthSince: '2030-01-01T00:00:00Z',
	})
} finally {
	await instance.release()
}
