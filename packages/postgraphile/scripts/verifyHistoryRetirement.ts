/** Destructive synthetic fixture only. Exercises the real Rust adopt command. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SQL } from 'bun'
import { restoreHistoryPreparation } from './historyRetirementFixture'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
const migrator = process.env.ZC_TEST_MIGRATOR
assert.ok(databaseUrl && migrator, 'ZC_TEST_DATABASE_URL and ZC_TEST_MIGRATOR required')
const parsed = new URL(databaseUrl)
assert.equal(parsed.hostname, '127.0.0.1')
assert.equal(parsed.pathname, '/zc_optimization_test')
const sql = new SQL(databaseUrl, { prepare: false })
const down = await readFile(
	new URL(
		'../../../crates/database/migrations/20261019000800_retire_history_index/down.sql',
		import.meta.url,
	),
	'utf8',
)
async function command(arguments_: string[], success = true) {
	const child = Bun.spawn([migrator as string, ...arguments_], {
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			NODE_ENV: 'production',
			OTEL_SDK_DISABLED: 'true',
		},
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const [code, output, error] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	])
	if (success) assert.equal(code, 0, output + error)
	else assert.notEqual(code, 0, 'Expected atomic migration failure')
	return output + error
}
async function adopt(success = true) {
	return command(['adopt'], success)
}
async function rows(tx: SQL) {
	return Array.from(
		await tx`select to_jsonb(h) as value from public.record_history_entry h order by history_view,id`,
	)
}
async function reverse() {
	await sql.begin((tx) => tx.unsafe(down))
	await sql`delete from zc_private.__diesel_schema_migrations where version='20261019000800'`
}
async function absent() {
	assert.equal(
		(
			await sql`select to_regclass('zc_private.record_history_index') is null
	 and to_regclass('zc_private.history_fact_rollout') is null
	 and to_regclass('zc_private.history_fact_dirty') is null as value`
		)[0].value,
		true,
	)
	assert.equal(
		(await sql`select to_regprocedure('zc_private.mirror_history_fact()') is null as value`)[0]
			.value,
		true,
	)
}
// Run identical authoritative writes before/after retirement, then roll them back.
async function exercise() {
	const rollback = new Error('rollback synthetic writes')
	let result: unknown
	await assert.rejects(
		sql.begin(async (tx) => {
			await tx`insert into public.record(id,id_user,id_level,time,game_version,mod_version,date_created)
		 overriding system value values(5001,1,1,5,'test','test','2026-10-18 12:00Z')`
			await tx`update public.personal_best_global set id_record=5001 where id_user=1 and id_level=1`
			await tx`update public.world_record_global set id_record=5001 where id_level=1`
			await tx`update public.user_point_contribution set id_record=5001,level_points=1200 where id_record=1`
			await tx`update public.user_point_contribution set player_decayed_points=42 where id_record=5001`
			await tx`delete from public.user_point_contribution where id_record=5001`
			await tx`insert into public.level_points(id_level,points) values(1,1500) on conflict(id_level) do update set points=excluded.points`
			const fallback = Array.from(
				await tx`select history_view,level_points from public.record_history_entry where id=5001 order by history_view`,
			)
			await tx`update public.level_points set points=1600 where id_level=1`
			await tx`delete from public.level_points where id_level=1`
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
			await tx`update zc_private.record_validation set status='pass' where id_record=1`
			await tx`update public."user" set steam_name='Changed display name' where id=1`
			await tx`update public.level_item set name='Changed level name' where id_level=1`
			await tx`delete from public.record where id=4`
			result = { fallback, rows: await rows(tx as unknown as SQL) }
			throw rollback
		}),
		(error: unknown) => error === rollback,
	)
	return result
}
try {
	await restoreHistoryPreparation(sql)
	await sql`delete from zc_private.__diesel_schema_migrations where version='20261019000800'`
	await sql.unsafe(
		await readFile(
			new URL('../../../crates/database/tests/fixtures/global_metrics.sql', import.meta.url),
			'utf8',
		),
	)
	await sql`insert into public.record(id,id_user,id_level,time,game_version,mod_version)
	 overriding system value select n,1,1,100+n,'test','test' from generate_series(100,3100) n`
	const expected = await rows(sql)
	const expectedWrites = await exercise()
	await sql`truncate zc_private.record_history_fact`
	assert.equal(Number((await sql`select zc_private.backfill_history_fact(1000) as n`)[0].n), 1000)
	assert.equal(
		(await sql`select backfill_done from zc_private.history_fact_rollout`)[0].backfill_done,
		false,
	)
	const identity = (
		await sql`select oid,relacl::text,reloptions,obj_description(oid) as comment from pg_class where oid='public.record_history_entry'::regclass`
	)[0]
	await adopt()
	await absent()
	await sql`insert into zc_private.__diesel_schema_migrations(version) values('99999999999999')`
	assert.ok(
		(
			await command(['optimize-history', 'rollback', '--writers-paused-and-qualified'], false)
		).includes('Revert later migrations'),
	)
	await absent()
	await sql`delete from zc_private.__diesel_schema_migrations where version='99999999999999'`
	assert.deepEqual(await rows(sql), expected)
	assert.deepEqual(await exercise(), expectedWrites)
	assert.deepEqual(
		(
			await sql`select oid,relacl::text,reloptions,obj_description(oid) as comment from pg_class where oid='public.record_history_entry'::regclass`
		)[0],
		identity,
	)
	await adopt() // Catalog verification and repeated adopt work without rollout tables.
	assert.ok((await adopt()).includes('verified'))
	await command(['optimize-history', 'rollback', '--writers-paused-and-qualified'])
	assert.deepEqual(await rows(sql), expected)
	assert.equal(
		(
			await sql`select zc_private.history_fact_mismatch(array(select id from public.record)) as value`
		)[0].value,
		false,
	)
	await sql`select zc_private.rollback_history_fact()`
	assert.deepEqual(await exercise(), expectedWrites)
	await sql`select zc_private.cutover_history_fact(true,true)` // Already-active deployment path.
	await adopt()
	await absent()
	assert.deepEqual(await exercise(), expectedWrites)
	await reverse()
	await sql`update zc_private.record_history_fact set time=time+1 where id=1`
	await sql`update zc_private.history_fact_rollout set verify_after=0,verified=false`
	assert.ok((await adopt(false)).includes('parity failed'))
	assert.equal(
		(await sql`select to_regclass('zc_private.record_history_index') is not null as value`)[0]
			.value,
		true,
	)
	await sql`update zc_private.record_history_fact set time=(select time from public.record where id=1) where id=1`
	const ready = Promise.withResolvers<void>()
	const release = Promise.withResolvers<void>()
	const reader = sql.begin(async (tx) => {
		await tx`set transaction read only`
		await tx`select id from public.record_history_entry limit 1`
		ready.resolve()
		await release.promise
	})
	void reader.catch(ready.reject)
	try {
		await ready.promise
		assert.ok((await adopt(false)).includes('lock timeout'))
		assert.equal(
			(
				await sql`select to_regclass('zc_private.record_history_index') is not null as value`
			)[0].value,
			true,
		)
	} finally {
		release.resolve()
		await reader
	}
	// Unexpected dependency must roll back writers and all DDL, not cascade-delete readers.
	await sql`create view public.history_retirement_dependency as select id from zc_private.record_history_index`
	assert.ok((await adopt(false)).includes('depend'))
	assert.equal(
		(
			await sql`select pg_get_functiondef('zc_private.sync_record_history_records(integer[])'::regprocedure) like '%INSERT INTO zc_private.record_history_index%' as value`
		)[0].value,
		true,
	)
	await sql`drop view public.history_retirement_dependency`
	await adopt()
	await absent()
	assert.deepEqual(await rows(sql), expected)
	console.log(
		'Automatic adopt: resumed backfill, parity, direct writes, RLS, reversal, active cutover, idempotency, and atomic dependency failure passed',
	)
} finally {
	await sql.close()
}
