/** Only disposable, local Adventure databases are accepted. */
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import cors from '@elysia/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { SQL } from 'bun'
import { Elysia } from 'elysia'
import { websocket } from 'elysia/websocket'
import { postgraphile } from 'postgraphile'
import { parse, print, printType } from 'postgraphile/graphql'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'
import { createPostGraphileRuntime } from '../src/postgraphileRuntime'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
assert.ok(databaseUrl, 'ZC_TEST_DATABASE_URL required')
const url = new URL(databaseUrl)
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.pathname, '/adventure_leaderboard_test')
const sql = new SQL(databaseUrl, { prepare: false })
try {
	if (process.argv.includes('--migrate')) {
		await sql.begin(async (tx) => {
			for (const [name, present] of [
				[
					'20261108020000_adventure_leaderboards',
					(
						await tx`select to_regclass('public.adventure_level_membership') is not null as present`
					)[0].present,
				],
				[
					'20261108030000_adventure_level_items',
					(
						await tx`select to_regprocedure('public.adventure_level_membership_level_item(public.adventure_level_membership)') is not null as present`
					)[0].present,
				],
			] as const) {
				if (!present)
					await tx.unsafe(
						await readFile(
							new URL(
								`../../../crates/database/migrations/${name}/up.sql`,
								import.meta.url,
							),
							'utf8',
						),
					)
			}
		})
	}
	if (process.argv.includes('--seed')) {
		await sql.begin(async (tx) => {
			await tx.unsafe(
				await readFile(
					new URL(
						'../../../crates/database/tests/fixtures/adventure_leaderboards_full.sql',
						import.meta.url,
					),
					'utf8',
				),
			)
		})
		await sql.unsafe('ALTER ROLE zeepcentraal_graphql LOGIN')
	}
	const restrictedUrl = new URL(databaseUrl)
	restrictedUrl.username = 'zeepcentraal_graphql'
	const handler = postgraphile(
		createPostGraphilePreset({
			databaseUrl: restrictedUrl.toString(),
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
		const schema = await handler.getSchema()
		for (const root of [schema.getQueryType(), schema.getSubscriptionType()]) {
			assert.ok(root?.getFields().adventureLeaderboard)
		}
		const scope = schema.getType('AdventureLeaderboardScope')
		assert.ok(scope && 'getFields' in scope)
		assert.ok(scope.getFields().entries)
		if (process.argv.includes('--write-schema')) {
			const path = new URL('../../graphql/schema.graphql', import.meta.url)
			let source = await readFile(path, 'utf8')
			for (const type of Object.values(schema.getTypeMap())) {
				if (type.name.startsWith('Adventure')) {
					const definition = printType(type)
					const existing = parse(source).definitions.find(
						(node) => 'name' in node && node.name?.value === type.name,
					)
					source = existing?.loc
						? `${source.slice(0, existing.loc.start)}${definition}${source.slice(existing.loc.end)}`
						: `${source}\n${definition}\n`
				} else if ('getFields' in type && !type.name.startsWith('__')) {
					const fields = Object.values(type.getFields()).filter((field) =>
						field.type
							.toString()
							.replace(/[[\]!]/g, '')
							.startsWith('Adventure'),
					)
					if (!fields.length) continue
					const definition = parse(printType(type)).definitions[0]
					for (const field of fields) {
						assert.ok(definition && 'fields' in definition)
						const fieldDefinition = definition.fields?.find(
							(item) => item.name.value === field.name,
						)
						assert.ok(fieldDefinition)
						const block = `\n${print(fieldDefinition)
							.split('\n')
							.map((line) => `  ${line}`)
							.join('\n')}`
						const pattern = new RegExp(
							`((?:type|input) ${type.name}(?: [^{]+)? \\{)([\\s\\S]*?)(\\n\\})`,
						)
						source = source.replace(pattern, (match, start, body, end) =>
							new RegExp(`\\n  ${field.name}[:(]`).test(body)
								? match
								: `${start}${body}${block}${end}`,
						)
					}
				}
			}
			await writeFile(path, source)
		}
		console.log('Adventure GraphQL schema verified')
		const server = handler.createServ(elysiaGrafserv)
		const document = await readFile(
			new URL(
				'../../graphql/documents/web/queries/adventureLeaderboard.graphql',
				import.meta.url,
			),
			'utf8',
		)
		type Scope = {
			totalLevels: number
			totalPlayers: number
			entries: {
				edges: Array<{ node: { rank: number; userId: number } }>
				pageInfo: { startCursor: string; endCursor: string }
			}
			playerEntry: { rank: number } | null
			missingLevels: { nodes: unknown[] }
		}
		async function query(variables: Record<string, unknown>) {
			const response = await server.handleGraphQLRequest(
				new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						query: document,
						operationName: 'ZC_AdventureLeaderboard',
						variables,
					}),
				}),
			)
			assert.ok(response)
			const result = (await response.json()) as {
				errors?: unknown
				data: { adventureLeaderboard: Scope }
			}
			assert.equal(result.errors, undefined, JSON.stringify(result.errors))
			return result.data.adventureLeaderboard
		}
		if (process.argv.includes('--verify')) {
			const variables = { series: 'a', first: 50, viewerId: 65, includeViewer: true }
			const first = await query(variables)
			assert.equal(first?.totalLevels, 2)
			assert.equal(first?.totalPlayers, 65)
			assert.equal(first.entries.edges.length, 50)
			assert.deepEqual(
				first.entries.edges.slice(0, 3).map((edge) => edge.node.rank),
				[1, 1, 3],
			)
			assert.equal(first.playerEntry?.rank, 65)
			assert.equal(first.missingLevels?.nodes.length, 1)
			const second = await query({ ...variables, after: first.entries.pageInfo.endCursor })
			assert.equal(second?.entries.edges.length, 15)
			const backward = await query({
				...variables,
				first: undefined,
				last: 50,
				before: second.entries.pageInfo.startCursor,
			})
			assert.deepEqual(backward.entries.edges, first.entries.edges)
			const defaultPage = await server.handleGraphQLRequest(
				new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						query: '{ adventureLeaderboard(series: "a") { entries { nodes { userId } } } }',
					}),
				}),
			)
			assert.ok(defaultPage)
			const defaultResult = (await defaultPage.json()) as {
				errors?: unknown
				data: { adventureLeaderboard: { entries: { nodes: unknown[] } } }
			}
			assert.equal(defaultResult.errors, undefined)
			assert.equal(defaultResult.data.adventureLeaderboard.entries.nodes.length, 65)
			assert.equal(
				new Set(
					[...first.entries.edges, ...second.entries.edges].map(
						({ node }) => node.userId,
					),
				).size,
				65,
			)
			const global = await query({ ...variables, series: null })
			assert.equal(global?.totalLevels, 18)
			const empty = await query({ ...variables, series: 'XG', viewerId: 0 })
			assert.equal(empty?.totalLevels, 1)
			assert.equal(empty?.totalPlayers, 0)
			assert.equal(empty?.playerEntry, null)
			const invalid = await server.handleGraphQLRequest(
				new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						query: '{ adventureLeaderboard(series: "unknown") { totalLevels } }',
					}),
				}),
			)
			assert.ok(invalid)
			assert.ok(((await invalid.json()) as { errors?: unknown[] }).errors?.length)
			console.log(
				'Restricted Adventure GraphQL ranking, viewer lookup, pagination and empty scopes passed',
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
					databaseUrl: restrictedUrl.toString(),
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
				.post('/__test/improve', async () => {
					await sql.begin(async (tx) => {
						await tx`insert into public.record(id,id_user,id_level,time,game_version,mod_version) overriding system value values(68,1,2,50,'test','test')`
						await tx`update public.personal_best_global set id_record=68 where id_user=1 and id_level=2`
					})
					return 'ok'
				})
				.post('/__test/advance-wr', async () => {
					await sql.begin(async (tx) => {
						await tx`insert into public.record(id,id_user,id_level,time,game_version,mod_version) overriding system value values(69,3,1,1,'test','test')`
						await tx`update public.personal_best_global set id_record=69 where id_user=3 and id_level=1`
						await tx`update public.world_record_global set id_record=69 where id_level=1`
					})
					return 'ok'
				})
				.post('/__test/long-player', async () => {
					await sql`update public."user" set steam_name=repeat(case when id=65 then 'W' else 'X' end,120) where id in(64,65)`
					return 'ok'
				})
				.post('/__test/reset', async () => {
					await sql.begin(async (tx) => {
						await tx.unsafe(
							await readFile(
								new URL(
									'../../../crates/database/tests/fixtures/adventure_leaderboards_full.sql',
									import.meta.url,
								),
								'utf8',
							),
						)
					})
					return 'ok'
				})
				.listen({ hostname: '127.0.0.1', port: 55440 })
			console.log('Adventure fixture ready on 127.0.0.1:55440')
			await new Promise(() => {})
		}
	} finally {
		await handler.release()
	}
} finally {
	await sql.close()
}
