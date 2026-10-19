import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import type { SQL } from 'bun'

/** Called only by the guarded, synthetic database verification script. */
export async function verifyHistoryFactMigration(sql: SQL) {
	const migration = new URL(
		'../../../crates/database/migrations/20261019000700_fix_history_fact_ordered_scans/',
		import.meta.url,
	)
	const [up, down] = await Promise.all(
		['up.sql', 'down.sql'].map((file) => readFile(new URL(file, migration), 'utf8')),
	)
	assert.ok(up && down)
	const rollback = new Error('rollback migration checks')
	await assert.rejects(
		sql.begin(async (tx) => {
			const identity = async () =>
				(
					await tx`select oid,relacl::text,reloptions,obj_description(oid) as comment
				 from pg_class where oid='public.record_history_entry'::regclass`
				)[0]
			const state = async () =>
				(
					await tx`select to_jsonb(s)-'switched_at' as value from zc_private.history_fact_rollout s`
				)[0].value
			const definition = async () =>
				(
					await tx`select pg_get_viewdef('public.record_history_entry'::regclass,true) as value`
				)[0].value as string
			const rows = async () =>
				Array.from(
					await tx`select * from public.record_history_entry order by history_view,id`,
				)
			const originalIdentity = await identity()
			const originalState = await state()
			const legacy = await definition()
			const reference = await rows()

			// Inactive rollout: both directions must leave legacy readers untouched.
			await tx.unsafe(down)
			assert.equal(await definition(), legacy)
			await tx.unsafe(up)
			assert.equal(await definition(), legacy)
			assert.deepEqual(await identity(), originalIdentity)
			assert.deepEqual(await state(), originalState)

			// Recreate a previously deployed cutover, then upgrade it in place.
			await tx.unsafe(down)
			await tx`select zc_private.cutover_history_fact(true,true)`
			const previousDefinition = await definition()
			assert.notEqual(previousDefinition, legacy)
			const previousTime = (
				await tx`select switched_at::text as value from zc_private.history_fact_rollout`
			)[0].value
			await tx.unsafe(up)
			const corrected = await definition()
			assert.notEqual(corrected, previousDefinition)
			assert.deepEqual(await rows(), reference)
			assert.deepEqual(await identity(), originalIdentity)
			assert.deepEqual(await state(), originalState)
			assert.equal(
				(
					await tx`select switched_at>${previousTime}::timestamptz as newer from zc_private.history_fact_rollout`
				)[0].newer,
				true,
			)
			assert.equal(
				(
					await tx`select has_function_privilege('zeepcentraal_graphql','zc_private.history_fact_view_definition()','EXECUTE') as allowed`
				)[0].allowed,
				false,
			)
			await tx`set local role zeepcentraal_graphql`
			assert.equal(
				(await rows()).some((row) => (row as { id: number }).id === 5),
				false,
			)
			await tx`reset role`

			// Reversal keeps the fact source active; legacy rollback stays separate.
			await tx.unsafe(down)
			assert.equal(await definition(), previousDefinition)
			assert.deepEqual(await rows(), reference)
			assert.equal(
				(
					await tx`select switched_at is not null as active from zc_private.history_fact_rollout`
				)[0].active,
				true,
			)
			await tx.unsafe(up)
			await tx`select zc_private.rollback_history_fact()`
			assert.equal(await definition(), legacy)
			await tx`select zc_private.cutover_history_fact(true,true)`
			assert.equal(await definition(), corrected)
			assert.deepEqual(await rows(), reference)
			throw rollback
		}),
		(error: unknown) => error === rollback,
	)

	// A long-lived reader must abort the entire hotfix, not leave half an upgrade.
	await sql.begin(async (tx) => {
		await tx.unsafe(down)
		await tx`select zc_private.cutover_history_fact(true,true)`
	})
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
		await assert.rejects(
			sql.begin(async (tx) => {
				await tx.unsafe(up)
			}),
			(error: unknown) =>
				typeof error === 'object' &&
				error !== null &&
				(('errno' in error && error.errno === '55P03') ||
					('code' in error && error.code === '55P03')),
		)
		assert.equal(
			(
				await sql`select to_regprocedure('zc_private.history_fact_view_definition()') is null as absent`
			)[0].absent,
			true,
		)
		assert.equal(
			(
				await sql`select pg_get_functiondef('zc_private.cutover_history_fact(boolean,boolean)'::regprocedure) not like '%history_fact_view_definition%' as unchanged`
			)[0].unchanged,
			true,
		)
	} finally {
		release.resolve()
		await reader
		await sql.begin(async (tx) => {
			await tx.unsafe(up)
		})
		await sql`select zc_private.rollback_history_fact()`
	}
}
