/** Isolated database only. Generates lobby schema additions from real PostGraphile. */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import cors from '@elysia/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type {
	Zc_LobbyDetailQuery,
	Zc_LobbyRoomsQuery,
	Zc_LobbyStatisticsQuery,
} from '@zeepkist/graphql/generated'
import { SQL } from 'bun'
import { Elysia } from 'elysia'
import { websocket } from 'elysia/websocket'
import { postgraphile } from 'postgraphile'
import { getNamedType, isObjectType, parse, print, printType } from 'postgraphile/graphql'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'
import { createPostGraphileRuntime } from '../src/postgraphileRuntime'

const databaseUrl =
	process.env.ZC_TEST_DATABASE_URL ??
	'postgres://postgres@127.0.0.1:55439/zc_lobby_dashboard_test'
const url = new URL(databaseUrl)
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.pathname, '/zc_lobby_dashboard_test')
const sql = new SQL(databaseUrl, { prepare: false })
try {
	if (process.argv.includes('--seed')) {
		await sql.begin(async (tx) => {
			await tx.unsafe('TRUNCATE public.lobby_history,public.lobby_stats,public.lobby CASCADE')
			await tx.unsafe(
				await readFile(
					new URL(
						'../../../crates/database/tests/fixtures/lobby_dashboard.sql',
						import.meta.url,
					),
					'utf8',
				),
			)
		})
		await sql.unsafe(
			'GRANT SELECT,DELETE ON public.live_query_invalidations TO zeepcentraal_graphql',
		)
	}
	if (process.argv.includes('--migrate')) {
		await sql.unsafe(`GRANT USAGE ON SCHEMA public TO zeepcentraal_graphql;
		GRANT SELECT(id,steam_id,steam_name) ON public."user" TO zeepcentraal_graphql;
		GRANT SELECT(id,room_name,host_id,players,player_limit,is_public,peak_players,peak_time,first_seen,last_seen,closed_at,date_created,date_updated) ON public.lobby TO zeepcentraal_graphql;
		GRANT SELECT ON public.lobby_history,public.lobby_stats TO zeepcentraal_graphql;`)
		await sql.begin(async (tx) =>
			tx.unsafe(
				await readFile(
					new URL(
						'../../../crates/database/migrations/20261108040000_lobby_dashboard/up.sql',
						import.meta.url,
					),
					'utf8',
				),
			),
		)
	}
	url.username = 'zeepcentraal_graphql'
	const handler = postgraphile(
		createPostGraphilePreset({
			databaseUrl: url.toString(),
			nodeEnv: 'production',
			allowExplain: false,
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
		const { schema } = await handler.getSchemaResult()
		const types = Object.values(schema.getTypeMap()).filter((type) =>
			type.name.includes('Lobb'),
		)
		if (process.argv.includes('--schema')) {
			const path = new URL('../../graphql/schema.graphql', import.meta.url)
			let source = await readFile(path, 'utf8')
			for (const type of types) {
				const pattern = new RegExp(
					`^(?:type|input|enum) ${type.name}(?: [^{]+)? \\{[\\s\\S]*?^\\}`,
					'm',
				)
				if (pattern.test(source)) {
					const definition = parse(printType(type)).definitions[0]
					assert.ok(definition && 'description' in definition)
					source = source.replace(
						pattern,
						print({ ...definition, description: undefined }),
					)
				} else source += `\n${printType(type)}\n`
			}
			for (const name of ['Query', 'Subscription', 'User']) {
				const real = schema.getType(name)
				if (!isObjectType(real)) continue
				const fields = Object.values(real.getFields()).filter((field) =>
					getNamedType(field.type).name.includes('Lobb'),
				)
				const actual = parse(printType(real)).definitions[0]
				assert.ok(actual && 'fields' in actual)
				const added =
					actual.fields?.filter((field) =>
						fields.some((item) => item.name === field.name.value),
					) ?? []
				const pattern = new RegExp(`(type ${name}(?: [^{]+)? \\{)([\\s\\S]*?)(\\n\\})`)
				for (const field of added) {
					const block = `\n${print(field)
						.split('\n')
						.map((line) => `  ${line}`)
						.join('\n')}`
					source = source.replace(pattern, (match, start, body, end) =>
						new RegExp(`\\n  ${field.name.value}[:(]`).test(body)
							? match
							: `${start}${body}${block}${end}`,
					)
				}
			}
			await writeFile(path, source)
		}
		console.log('Lobby GraphQL schema verified')
		const server = handler.createServ(elysiaGrafserv)
		const documents = await readFile(
			new URL('../../graphql/documents/web/queries/lobby.graphql', import.meta.url),
			'utf8',
		)
		async function query<TData>(
			operationName: string,
			variables: Record<string, unknown>,
			document = documents,
		) {
			const response = await server.handleGraphQLRequest(
				new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query: document, operationName, variables }),
				}),
			)
			assert.ok(response)
			const result = (await response.json()) as { errors?: unknown; data: TData }
			assert.equal(result.errors, undefined, JSON.stringify(result.errors))
			return result.data
		}
		if (process.argv.includes('--verify')) {
			const period = {
				dateCreated: {
					greaterThanOrEqualTo: '2001-01-01T00:00:00Z',
					lessThan: '2001-01-02T00:00:00Z',
				},
			}
			const statistics = await query<Zc_LobbyStatisticsQuery>('ZC_LobbyStatistics', {
				filter: period,
				previousFilter: period,
				peakFilter: period,
				groupBy: ['DATE_CREATED_TRUNCATED_TO_HOUR'],
			})
			assert.equal(statistics.onlinePeak?.nodes[0]?.players, 200)
			assert.equal(statistics.participationPeak?.nodes[0]?.playersInRooms, 80)
			assert.equal(statistics.roomsPeak?.nodes[0]?.rooms, 10)
			assert.equal(statistics.period?.groupedAggregates?.length, 3)
			assert.equal(Number(statistics.period?.aggregates?.sum?.players), 440)
			assert.equal(Number(statistics.period?.aggregates?.sum?.playersInRooms), 140)
			const detail = await query<Zc_LobbyDetailQuery>('ZC_LobbyDetail', {
				id: '1001',
				first: 50,
			})
			assert.equal(detail.lobbyListing?.host?.steamName, 'Lobby Test Host')
			assert.ok((detail.lobbyOccupancyTimeline?.nodes.length ?? Infinity) <= 201)
			assert.equal(detail.lobbyHistories?.nodes.length, 50)
			const next = await query<Zc_LobbyDetailQuery>('ZC_LobbyDetail', {
				id: '1001',
				first: 50,
				after: detail.lobbyHistories?.pageInfo.endCursor,
			})
			assert.notEqual(next.lobbyHistories?.nodes[0]?.id, detail.lobbyHistories?.nodes[0]?.id)
			const rooms = await query<Zc_LobbyRoomsQuery>('ZC_LobbyRooms', {
				first: 25,
				filter: { isPublic: { equalTo: false } },
				orderBy: ['ID_ASC'],
			})
			assert.equal(rooms.lobbyListings?.nodes[0]?.roomName, 'Private midnight room')
			const occupancy = await query<Zc_LobbyRoomsQuery>('ZC_LobbyRooms', {
				first: 25,
				filter: { id: { greaterThan: '0' } },
				orderBy: ['OCCUPANCY_DESC', 'ID_ASC'],
			})
			assert.equal(occupancy.lobbyListings?.nodes.at(-1)?.id, '1003')
			assert.equal(schema.getQueryType()?.getFields().lobbyByMasterId, undefined)
			const lobbyType = schema.getType('Lobby')
			assert.ok(lobbyType)
			assert.ok(!printType(lobbyType).includes('masterId'))
			for (const group of [
				'DATE_CREATED_TRUNCATED_TO_FIVE_MINUTES',
				'DATE_CREATED_TRUNCATED_TO_SIX_HOURS',
				'DATE_CREATED_TRUNCATED_TO_MONTH',
			])
				await query<Zc_LobbyStatisticsQuery>('ZC_LobbyStatistics', {
					filter: period,
					previousFilter: period,
					peakFilter: period,
					groupBy: [group],
				})
			console.log(
				'Restricted lobby GraphQL aggregates, peaks, privacy, timelines and cursors passed',
			)
			const boundedHistory = await query<{ lobbyHistories: { nodes: unknown[] } }>(
				'ZC_LobbyNullPagination',
				{ first: null, last: null },
				'query ZC_LobbyNullPagination($first:Int,$last:Int) { lobbyHistories(first:$first,last:$last) { nodes {id} } }',
			)
			console.log(
				`Explicit-null event pagination returned ${boundedHistory.lobbyHistories.nodes.length} rows`,
			)
			assert.equal(boundedHistory.lobbyHistories.nodes.length, 100)
			const backward = await query<{ lobbyHistories: { nodes: unknown[] } }>(
				'ZC_LobbyNullPagination',
				{ first: null, last: 25 },
				'query ZC_LobbyNullPagination($first:Int,$last:Int) { lobbyHistories(first:$first,last:$last) { nodes {id} } }',
			)
			assert.equal(backward.lobbyHistories.nodes.length, 25)
			for (const [connection, rowCount] of [
				['lobbyHistories', 1007],
				['lobbyStats', 293],
				['users', 1],
			] as const) {
				const document = `query Pagination($first:Int,$last:Int) { ${connection}(first:$first,last:$last) { nodes {id} } }`
				for (const variables of [{}, { first: null, last: null }]) {
					const data = await query<Record<string, { nodes: unknown[] }>>(
						'Pagination',
						variables,
						document,
					)
					assert.equal(data[connection]?.nodes.length, Math.min(100, rowCount))
				}
				for (const argument of ['first', 'last']) {
					const data = await query<Record<string, { nodes: unknown[] }>>(
						'Pagination',
						{ [argument]: 1000 },
						document,
					)
					assert.equal(data[connection]?.nodes.length, Math.min(1000, rowCount))
					await assert.rejects(
						query('Pagination', { [argument]: 1001 }, document),
						new RegExp(
							`Requested '${argument}' value of 1001 exceeds the limit of 1000`,
						),
					)
				}
			}
			console.log(
				'Global pagination: default 100, maximum 1000, forward/backward limits passed',
			)
		}
		if (process.argv.includes('--serve')) {
			const runtime = createPostGraphileRuntime(
				{
					createServ: () => server,
					getSchema: () => handler.getSchema(),
					release: () => handler.release(),
				},
				{
					...postgraphileConfig,
					databaseUrl: url.toString(),
					liveQueries: { ...postgraphileConfig.liveQueries, enabled: true },
				},
			)
			new Elysia()
				.use(cors())
				.use(websocket())
				.ws('/', runtime.liveQueryWebSocket)
				.post('/', runtime.graphqlRoute)
				.options('/', runtime.graphqlRoute)
				.get('/healthz', () => 'ok')
				.post('/__test/update', async () => {
					await sql`UPDATE public.lobby SET players=CASE WHEN players=3 THEN 2 ELSE 3 END,last_seen=now() WHERE id=1001`
					return 'ok'
				})
				.listen({ port: 55440, hostname: '127.0.0.1' })
			console.log('Isolated lobby GraphQL listening on 55440')
			await new Promise(() => {})
		}
	} finally {
		await handler.release()
	}
} finally {
	await sql.close()
}
