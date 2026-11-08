/** Isolated fixture only. Exercise actual PostGraphile cursors and viewer lookup. */
import assert from 'node:assert/strict'
import { parsePostgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { SQL } from 'bun'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphileHandler } from '../src/postgraphileOptions'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
assert.ok(databaseUrl, 'ZC_TEST_DATABASE_URL required')
const parsed = new URL(databaseUrl)
assert.equal(parsed.hostname, '127.0.0.1')
assert.equal(parsed.pathname, '/track_tournament_test')
const admin = new SQL(databaseUrl)
const reader = new URL(databaseUrl)
reader.username = 'zeepcentraal_graphql'
reader.password = ''
const handler = createPostGraphileHandler(
	parsePostgraphileConfig({
		NODE_ENV: 'production',
		POSTGRAPHILE_DATABASE_URL: reader.toString(),
		POSTGRAPHILE_LIVE_QUERIES: 'false',
	}),
)
let seeded = false
try {
	assert.equal(
		Number(
			(await admin`SELECT count(*) FROM public.track_tournament_overall_standing`)[0].count,
		),
		0,
		'Fixture requires empty cache',
	)
	await admin.unsafe(`INSERT INTO public."user"(id,steam_name) OVERRIDING SYSTEM VALUE SELECT 99000+i,'Overall player '||i FROM generate_series(1,51) i;
INSERT INTO public.track_tournament_overall_standing(type,id_user,total_points,events_played,rank)
SELECT 0,99000+i,CASE WHEN i<3 THEN 1000 ELSE 1000-i END,1,CASE WHEN i<3 THEN 1 ELSE i END FROM generate_series(1,51) i`)
	seeded = true
	const schema = await handler.getSchema()
	assert.equal(schema.getMutationType(), undefined)
	const server = handler.createServ(elysiaGrafserv)
	const document = await Bun.file(
		new URL(
			'../../graphql/documents/web/queries/trackTournamentOverall.graphql',
			import.meta.url,
		),
	).text()
	async function query(variables: Record<string, unknown>) {
		const response = await server.handleGraphQLRequest(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					query: document,
					variables: { type: 0, viewerId: 99051, includeViewer: true, ...variables },
				}),
			}),
		)
		assert.ok(response)
		const result = (await response.json()) as {
			errors?: unknown
			data: {
				period: { eligibleEventCount: number }
				standings: {
					nodes: Array<{ userId: number; rank: number; user: { steamName: string } }>
					totalCount: number
					pageInfo: {
						startCursor: string
						endCursor: string
						hasNextPage: boolean
						hasPreviousPage: boolean
					}
				}
				viewer: { rank: number } | null
			}
		}
		assert.equal(result.errors, undefined, JSON.stringify(result.errors))
		return result.data
	}
	const first = await query({ first: 2 })
	assert.deepEqual(
		first.standings.nodes.map((row) => row.rank),
		[1, 1],
	)
	assert.equal(first.standings.totalCount, 51)
	assert.equal(first.viewer?.rank, 51)
	assert.equal(first.period.eligibleEventCount, 0)
	const next = await query({ first: 2, after: first.standings.pageInfo.endCursor })
	assert.deepEqual(
		next.standings.nodes.map((row) => row.rank),
		[3, 4],
	)
	const back = await query({ last: 2, before: next.standings.pageInfo.startCursor })
	assert.deepEqual(
		back.standings.nodes.map((row) => row.userId),
		[99001, 99002],
	)
	const last = await query({ last: 1 })
	assert.deepEqual(
		last.standings.nodes.map((row) => row.rank),
		[51],
	)
	assert.equal(last.standings.pageInfo.hasNextPage, false)
	await admin`UPDATE public."user" SET steam_name='Changed overall name' WHERE id=99001`
	assert.equal(
		(await query({ first: 1 })).standings.nodes[0]?.user.steamName,
		'Changed overall name',
	)
	assert.equal((await query({ first: 1, type: 1 })).standings.totalCount, 0)
	assert.equal((await query({ first: 1, viewerId: 0 })).viewer, null)
	console.log(
		'Overall GraphQL: ties, cursors, viewer, metadata, names, separate types, read-only schema passed',
	)
} finally {
	await handler.release()
	if (seeded) await admin`DELETE FROM public."user" WHERE id BETWEEN 99001 AND 99051`
	await admin.close()
}
