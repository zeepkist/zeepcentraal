/** Run explicitly against a disposable local sql_test database, outside unit-test preload. */
import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { postgraphile } from 'postgraphile'
import { makePgService } from 'postgraphile/adaptors/pg'
import {
	getNamedType,
	isObjectType,
	lexicographicSortSchema,
	printSchema,
} from 'postgraphile/graphql'
import { makeBunPgService } from '../src/bunSqlAdaptor'
import { BunSqlSubscriber } from '../src/bunSqlSubscriber'
import { assertRestrictedGraphqlDatabaseRole } from '../src/databaseRoleAudit'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createLiveQueryInvalidationStore } from '../src/liveQueryInvalidationPoller'
import {
	createPostGraphilePgServiceOptions,
	createPostGraphilePreset,
} from '../src/postgraphileOptions'

const url = process.env.BUN_SQL_TEST_URL
if (!url) throw new Error('BUN_SQL_TEST_URL must point to disposable local sql_test database')
const parsed = new URL(url)
if (
	!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
	parsed.pathname !== '/sql_test'
) {
	throw new Error('Integration checks require a disposable local sql_test database')
}
const admin = new SQL(url, { max: 2 })
const timeouts = { connectMs: 5000, statementMs: 15000, lockMs: 3000, idleTransactionMs: 30000 }
const restricted = new URL(url)
restricted.username = 'zeepcentraal_graphql'
restricted.password = 'sql-test-password'
const config = {
	databaseUrl: restricted.href,
	allowExplain: false,
	nodeEnv: 'production',
	databaseTimeouts: timeouts,
	databasePoolMax: 4,
	cacheMaxEntries: 128,
	operationPlansPerOperation: 8,
	liveQueries: { enabled: true },
}
const service = makeBunPgService(createPostGraphilePgServiceOptions(config))
assert(service.adaptorSettings)
const withClient = await service.adaptor.createWithPgClient(service.adaptorSettings)
try {
	await admin.unsafe(
		'DO $$ BEGIN CREATE ROLE zeepcentraal_graphql LOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$',
	)
	await admin.unsafe("ALTER ROLE zeepcentraal_graphql PASSWORD 'sql-test-password'")
	await admin.unsafe(
		'CREATE TABLE IF NOT EXISTS public.live_query_invalidations (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())',
	)
	await admin.unsafe(
		'GRANT SELECT, DELETE ON public.live_query_invalidations TO zeepcentraal_graphql',
	)
	await admin.unsafe(`CREATE TABLE public.bun_sql_fixture (
		id integer PRIMARY KEY, name text NOT NULL, parent_id integer REFERENCES public.bun_sql_fixture,
		large bigint, amount numeric, moment timestamptz, info jsonb, numbers integer[]
	)`)
	await admin.unsafe(`INSERT INTO public.bun_sql_fixture VALUES
		(1, 'first', NULL, 9007199254740993, 12.345, '2026-01-02T03:04:05Z', '{"ok":true}', ARRAY[1,2]),
		(2, 'second', 1, 9007199254740994, 23.456, '2026-01-03T03:04:05Z', '{"ok":false}', ARRAY[3,4])`)
	await admin.unsafe('GRANT SELECT ON public.bun_sql_fixture TO zeepcentraal_graphql')
	await admin.unsafe(
		"CREATE OR REPLACE FUNCTION public.bun_sql_error() RETURNS integer LANGUAGE plpgsql STABLE AS $$ BEGIN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'fixture error', DETAIL = 'fixture detail', HINT = 'fixture hint'; END $$",
	)
	await assertRestrictedGraphqlDatabaseRole(restricted.href)

	await withClient({ 'app.bun_sql_test': 'private' }, async (client) => {
		const result = await client.query<{ value: string }>({
			text: "select current_setting('app.bun_sql_test') as value",
		})
		assert.equal(result.rows[0]?.value, 'private')
		await assert.rejects(
			client.withTransaction(async (nested) => {
				await nested.query({
					text: "select set_config('app.bun_sql_test', 'nested', true)",
				})
				throw new Error('rollback fixture')
			}),
			/rollback fixture/,
		)
		assert.equal(
			(
				await client.query<{ value: string }>({
					text: "select current_setting('app.bun_sql_test') as value",
				})
			).rows[0]?.value,
			'private',
		)
	})
	await withClient(null, async (client) => {
		assert.notEqual(
			(
				await client.query<{ value: string }>({
					text: "select current_setting('app.bun_sql_test', true) as value",
				})
			).rows[0]?.value,
			'private',
		)
	})
	await Promise.all(
		Array.from({ length: 8 }, (_, index) =>
			withClient({ 'app.bun_sql_test': String(index) }, async (client) => {
				const result = await client.query<{ value: string }>({
					text: "select current_setting('app.bun_sql_test') as value, pg_sleep(0.01)",
				})
				assert.equal(result.rows[0]?.value, String(index))
			}),
		),
	)
	await assert.rejects(
		withClient({ statement_timeout: '10' }, async (client) => {
			await client.query({ text: 'select pg_sleep(1)' })
		}),
		(error: unknown) => error instanceof Error && Reflect.get(error, 'code') === '57014',
	)

	const native = postgraphile(createPostGraphilePreset(config))
	const baselinePreset = createPostGraphilePreset(config)
	await baselinePreset.pgServices?.[0]?.release?.()
	baselinePreset.pgServices = [makePgService(createPostGraphilePgServiceOptions(config))]
	const baseline = postgraphile(baselinePreset)
	try {
		const [nativeSchema, baselineSchema] = await Promise.all([
			native.getSchema(),
			baseline.getSchema(),
		])
		assert.equal(
			printSchema(lexicographicSortSchema(nativeSchema)),
			printSchema(lexicographicSortSchema(baselineSchema)),
		)
		const source =
			'{ bunSqlFixtures(first: 1, orderBy: ID_ASC) { totalCount nodes { id name large amount moment info numbers } pageInfo { hasNextPage endCursor } } }'
		const servers = new Map([
			[native, native.createServ(elysiaGrafserv)],
			[baseline, baseline.createServ(elysiaGrafserv)],
		])
		const execute = async (instance: typeof native, query = source) => {
			const server = servers.get(instance)
			assert(server)
			const response = await server.handleGraphQLRequest(
				new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ query }),
				}),
			)
			assert(response)
			return (await response.json()) as { data?: unknown; errors?: unknown }
		}
		const [a, b] = await Promise.all([execute(native), execute(baseline)])
		assert(!('errors' in a) || !a.errors, JSON.stringify(a))
		assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)))
		const fixtureType = nativeSchema.getType('BunSqlFixture')
		assert(fixtureType && isObjectType(fixtureType))
		const parentField = Object.values(fixtureType.getFields()).find(
			(field) => getNamedType(field.type).name === 'BunSqlFixture',
		)
		assert(parentField, 'Fixture parent relation missing')
		const relationQuery = `{ bunSqlFixtures(orderBy: ID_ASC) { nodes { id ${parentField.name} { id } } aggregates { sum { id } } } }`
		const [relations, previousRelations] = await Promise.all([
			execute(native, relationQuery),
			execute(baseline, relationQuery),
		])
		assert(!relations.errors, JSON.stringify(relations))
		assert.deepEqual(relations, previousRelations)
		const [error, previousError] = await Promise.all([
			execute(native, '{ bunSqlError }'),
			execute(baseline, '{ bunSqlError }'),
		])
		assert(error.errors)
		assert.deepEqual(error, previousError)
		console.log(
			'GraphQL schema, pagination, scalars/arrays/JSON, relations, aggregates and errors match pg adapter',
		)
	} finally {
		await Promise.all([native.release(), baseline.release()])
	}

	const watcher = postgraphile(
		createPostGraphilePreset({ ...config, nodeEnv: 'development', superuserDatabaseUrl: url }),
	)
	try {
		await watcher.getSchema()
		await admin.unsafe('ALTER TABLE public.bun_sql_fixture ADD COLUMN watch_probe integer')
		const deadline = Date.now() + 15000
		let watched = false
		while (Date.now() < deadline) {
			const type = (await watcher.getSchema()).getType('BunSqlFixture')
			if (type && isObjectType(type) && type.getFields().watchProbe) {
				watched = true
				break
			}
			await Bun.sleep(100)
		}
		assert(watched, 'Development schema watcher did not rebuild after DDL')
		console.log('Development schema watching with Bun SQL superuser setup passed')
	} finally {
		await watcher.release()
	}

	const binary = process.env.BUN_SQL_TEST_BINARY
	if (binary) {
		const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
		const port = probe.port
		await probe.stop(true)
		const child = Bun.spawn([binary], {
			env: {
				...process.env,
				NODE_ENV: 'production',
				GRAPHILE_ENV: 'production',
				OTEL_SDK_DISABLED: 'true',
				POSTGRAPHILE_DATABASE_URL: restricted.href,
				POSTGRAPHILE_SUPERUSER_DATABASE_URL: undefined,
				POSTGRAPHILE_HOST: '127.0.0.1',
				POSTGRAPHILE_PORT: String(port),
			},
			stdout: 'pipe',
			stderr: 'pipe',
		})
		const output = Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		])
		try {
			const deadline = Date.now() + 15000
			let ready = false
			while (Date.now() < deadline && child.exitCode === null) {
				try {
					const response = await fetch(`http://127.0.0.1:${port}/`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							query: '{ bunSqlFixtures(first: 1) { nodes { id } } }',
						}),
						signal: AbortSignal.timeout(1000),
					})
					const result = (await response.json()) as { data?: unknown; errors?: unknown }
					if (response.ok && result.data && !result.errors) {
						ready = true
						break
					}
				} catch {
					/* Process may still be starting. */
				}
				await Bun.sleep(100)
			}
			assert(ready, 'Compiled PostGraphile did not serve fixture query')
			console.log(
				'Compiled PostGraphile production startup, role audit and GraphQL query passed',
			)
		} finally {
			child.kill()
			await child.exited
			await output
		}
	}

	const listener = new SQL(url, {
		max: 1,
		connection: { application_name: 'bun-sql-integration-listener' },
	})
	const subscriber = new BunSqlSubscriber(listener)
	try {
		const a = subscriber.subscribe('bun_sql_test')
		const b = subscriber.subscribe('bun_sql_test')
		const sendUntilReceived = async (
			iterator: AsyncIterableIterator<string>,
			value: string,
		) => {
			const pending = iterator.next()
			let timer: ReturnType<typeof setInterval> | undefined
			let timeout: ReturnType<typeof setTimeout> | undefined
			try {
				timer = setInterval(() => {
					void admin.notify('bun_sql_test', value)
				}, 100)
				return await Promise.race([
					pending,
					new Promise<never>((_, reject) => {
						timeout = setTimeout(
							() => reject(new Error('Notification timed out')),
							10000,
						)
					}),
				])
			} finally {
				clearInterval(timer)
				clearTimeout(timeout)
			}
		}
		assert.equal((await sendUntilReceived(a, 'before')).value, 'before')
		assert.equal((await b.next()).value, 'before')
		await a.return?.()
		await admin.unsafe(
			"select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'bun-sql-integration-listener'",
		)
		assert.equal((await sendUntilReceived(b, 'after')).value, 'after')
		await b.return?.()
		console.log('LISTEN multiplexing, iterator cleanup, reconnect/resubscribe passed')
	} finally {
		await subscriber.release()
		await listener.close()
	}

	const store = createLiveQueryInvalidationStore({
		databaseUrl: restricted.href,
		databaseTimeouts: timeouts,
	})
	try {
		assert.equal(typeof (await store.getMaxId()), 'bigint')
		await store.prune(60)
	} finally {
		await store.close()
	}
	console.log(
		'Role audit, settings isolation, concurrency, savepoints, timeout and invalidation store passed',
	)
} finally {
	await service.release?.()
	await admin.unsafe('DROP TABLE IF EXISTS public.bun_sql_fixture')
	await admin.unsafe('DROP FUNCTION IF EXISTS public.bun_sql_error()')
	await admin.close()
}
