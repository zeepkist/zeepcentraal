/** Explicit local integration check; never loaded by the unit-test runner. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSqlClient } from '@zeepkist/core/sql'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'
import { bigint, integer, jsonb, numeric, pgTable, timestamp } from 'drizzle-orm/pg-core'
import { arrayParam } from '../arrayParam'
import { createDatabaseClientOptions } from '../clientOptions'
import { getPostgresSqlState } from '../migrationRetry'
import { createTracedPostgresClient } from '../telemetry'

const url = process.env.BUN_SQL_TEST_URL
if (
	!url ||
	new URL(url).pathname !== '/sql_test' ||
	!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
) {
	throw new Error('BUN_SQL_TEST_URL must point to a disposable local sql_test database')
}
const native = createSqlClient(
	url,
	createDatabaseClientOptions({
		databaseTimeouts: {
			connectMs: 5000,
			statementMs: 15000,
			lockMs: 3000,
			idleTransactionMs: 30000,
		},
	}),
)
const client = createTracedPostgresClient(native, url)
const fixture = pgTable('bun_drizzle_fixture', {
	id: integer().primaryKey(),
	large: bigint({ mode: 'bigint' }),
	amount: numeric(),
	info: jsonb(),
	numbers: integer().array(),
	moment: timestamp({ withTimezone: true }),
	localMoment: timestamp(),
	textMoment: timestamp({ withTimezone: true, mode: 'string' }),
})
const db = drizzle(client, { schema: { fixture } })
const folder = await mkdtemp(join(tmpdir(), 'zeepcentraal-bun-migrations-'))
try {
	if (process.argv.includes('--bootstrap-history')) {
		const [{ count }] = await client.unsafe(
			"SELECT count(*)::integer AS count FROM information_schema.tables WHERE table_schema = 'public'",
		)
		assert.equal(count, 0, 'Historical bootstrap requires empty public schema')
		const { generateMigration, generateDrizzleJson } = await import('drizzle-kit/api')
		const migrationsFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url))
		const snapshot = await Bun.file(join(migrationsFolder, 'meta/0001_snapshot.json')).json()
		for (const statement of await generateMigration(generateDrizzleJson({}), snapshot)) {
			await client.unsafe(statement).simple()
		}
		await migrate(db, { migrationsFolder })
		await migrate(db, { migrationsFolder })
		const { verifyGraphqlVisibility, verifyConcurrentRecordCounts } = await import(
			'./verifyGraphqlVisibility'
		)
		await verifyGraphqlVisibility(url)
		await verifyConcurrentRecordCounts(url)
		// Exercise actual scoring services against the disposable migrated schema.
		process.env.DATABASE_URL = url
		process.env.NODE_ENV = 'test'
		await client.unsafe(
			`INSERT INTO level (id, hash, xx_hash) OVERRIDING SYSTEM VALUE VALUES (83915, 'bun-scoring-fixture', 'bun-scoring-fixture')`,
		)
		const { closeDatabase } = await import('../client')
		try {
			const { updateLevelScoreBatch } = await import('../services/levelScore')
			const { persistUserPointScore, syncUserPointContributionLevels } = await import(
				'../services/userPointContribution'
			)
			const { rankActiveUsersByPoints, resetInactiveUserScores } = await import(
				'../services/userPoints'
			)
			await updateLevelScoreBatch({ idLevels: [83915] })
			await syncUserPointContributionLevels([83915, 83916])
			await resetInactiveUserScores([1, 2, 9, 83])
			await rankActiveUsersByPoints([1, 2, 9, 83])
			assert.equal(
				await persistUserPointScore({
					idUser: -1,
					points: 0,
					totalPoints: 0,
					contributions: Array.from({ length: 15000 }, (_, index) => ({
						idLevel: index + 1,
						idRecord: index + 1,
						levelPosition: 1,
						levelPoints: 9368,
						levelDecayedPoints: 6323.9565,
						contributionRank: index + 1,
						playerDecayedPoints: 5707.3706,
					})),
				}),
				false,
			)
		} finally {
			await closeDatabase()
			await client.unsafe('DELETE FROM level_points WHERE id_level = 83915')
			await client.unsafe('DELETE FROM level WHERE id = 83915')
		}
		console.log(
			'Scoring services: locks, projection, inactive reset, ranking and 15000-row snapshot passed',
		)
		console.log(
			'Historical baseline, all migrations/rerun, GraphQL visibility and concurrent record counts passed',
		)
	}

	// Raw UNNEST/ANY parameters bypass column encoders: cover scoring job bindings.
	await db.transaction(async (tx) => {
		for (const ids of [[], [83915], [1, 2, 9, 83]]) {
			const rows = await tx.execute<{ id: number }>(sql`
				SELECT id FROM UNNEST(${arrayParam(ids)}::integer[]) AS target(id)
				WHERE id = ANY(${arrayParam(ids)}::integer[]) ORDER BY id
			`)
			assert.deepEqual(
				rows.map((row) => row.id),
				ids,
			)
			await tx.execute(sql`
				SELECT pg_advisory_xact_lock(0, target.id)
				FROM UNNEST(${arrayParam(ids)}::integer[]) AS target(id) ORDER BY id
			`)
		}
		const [snapshot] = await tx.execute<{ count: number; amount: number }>(sql`
			SELECT count(*)::integer AS count, max(amount) AS amount FROM UNNEST(
				${arrayParam(Array.from({ length: 15000 }, (_, index) => index))}::integer[],
				${arrayParam([6323.9565])}::real[]
			) AS expected(id, amount)
		`)
		assert.equal(snapshot?.count, 15000)
		assert.equal(Math.fround(snapshot?.amount ?? 0), Math.fround(6323.9565))
		const text = ['comma,value', '"quoted"', 'back\\slash', '', 'NULL', null]
		const rows = await tx.execute<{ value: string | null }>(sql`
			SELECT value FROM UNNEST(${arrayParam(text)}::text[]) AS target(value)
		`)
		assert.deepEqual(
			rows.map((row) => row.value),
			text,
		)
	})

	await mkdir(join(folder, 'meta'))
	await writeFile(
		join(folder, 'meta/_journal.json'),
		JSON.stringify({
			version: '7',
			dialect: 'postgresql',
			entries: [{ idx: 0, version: '7', when: 1, tag: '0000_fixture', breakpoints: true }],
		}),
	)
	await writeFile(
		join(folder, '0000_fixture.sql'),
		'CREATE TABLE bun_drizzle_fixture (id integer PRIMARY KEY, large bigint, amount numeric, info jsonb, numbers integer[], moment timestamptz, "localMoment" timestamp, "textMoment" timestamptz);',
	)
	const options = { migrationsFolder: folder, migrationsSchema: 'bun_sql_migrations' }
	await migrate(db, options)
	await migrate(db, options)
	const instant = new Date('2026-01-02T03:04:05.000Z')
	const [created] = await db
		.insert(fixture)
		.values({
			id: 1,
			large: 9007199254740993n,
			amount: '12.345',
			info: { ok: true },
			numbers: [1, 2],
			moment: instant,
			localMoment: instant,
			textMoment: instant.toISOString(),
		})
		.returning()
	assert.equal(created?.large, 9007199254740993n)
	assert.equal(created?.amount, '12.345')
	assert.deepEqual(created?.info, { ok: true })
	assert.deepEqual(created?.numbers, [1, 2])
	assert.equal(created?.moment?.toISOString(), instant.toISOString())
	assert.equal(created?.localMoment?.toISOString(), instant.toISOString())
	assert.equal(typeof created?.textMoment, 'string')
	await client.unsafe(
		'UPDATE bun_drizzle_fixture SET "textMoment" = \'2026-01-02T03:04:05.123456Z\'',
	)
	assert.match((await db.select().from(fixture))[0]?.textMoment ?? '', /05\.123(?:[+-]|$)/)
	assert.equal(
		(await client.unsafe('SELECT jsonb_typeof(info) AS kind FROM bun_drizzle_fixture'))[0]
			?.kind,
		'object',
	)
	await assert.rejects(
		db.transaction(async (tx) => {
			await tx.update(fixture).set({ amount: '99' }).where(eq(fixture.id, 1))
			await assert.rejects(
				tx.transaction(async (nested) => {
					await nested.delete(fixture)
					throw new Error('nested rollback')
				}),
				/nested rollback/,
			)
			assert.equal((await tx.select().from(fixture)).length, 1)
			throw new Error('outer rollback')
		}),
		/outer rollback/,
	)
	assert.equal((await db.select().from(fixture))[0]?.amount, '12.345')
	await assert.rejects(
		db.insert(fixture).values({ id: 1 }),
		(error: unknown) => getPostgresSqlState(error) === '23505',
	)
	assert.equal((await db.execute(sql`SHOW statement_timeout`))[0]?.statement_timeout, '15s')
	assert.equal(
		(await client`SELECT ${client.array([1, 2], 'INTEGER')}::integer[] AS value`)[0]?.value
			.length,
		2,
	)
	await db.delete(fixture)
	console.log(
		'Drizzle CRUD, decoding, raw queries, tracing, nested rollback, SQLSTATE, timeouts, migration and rerun passed',
	)
} finally {
	await client.unsafe('DROP TABLE IF EXISTS bun_drizzle_fixture')
	await client.unsafe('DROP SCHEMA IF EXISTS bun_sql_migrations CASCADE')
	await client.close({ timeout: 5 })
	await rm(folder, { recursive: true, force: true })
}
