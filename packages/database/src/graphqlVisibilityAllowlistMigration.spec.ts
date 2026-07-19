import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
	new URL('../drizzle/0055_ancient_betty_brant.sql', import.meta.url),
	'utf8',
)

describe('GraphQL visibility allowlist migration', () => {
	test('creates indexed private visibility state and owner-backed views', () => {
		for (const table of [
			'level_record_count',
			'visible_level',
			'visible_level_item',
			'visible_workshop_item',
		]) {
			expect(migration).toContain(`CREATE TABLE "zc_private"."${table}"`)
		}

		expect(migration).toContain('"id_level" integer PRIMARY KEY NOT NULL')
		expect(migration).toContain('"id_level_item" integer PRIMARY KEY NOT NULL')
		expect(migration).toContain('"workshop_id" bigint PRIMARY KEY NOT NULL')
		expect(migration).toContain('"record_count" bigint NOT NULL')
		expect(migration).toContain('IX_graphql_visible_level_item_level')
		expect(migration).toContain('IX_graphql_visible_level_item_workshop')
		expect(migration).toContain(
			'CREATE VIEW "zc_private"."visible_record" WITH (security_barrier = true)',
		)
		expect(migration).toContain(
			'CREATE VIEW "zc_private"."visible_zsl_level" WITH (security_barrier = true)',
		)
	})

	test('backfills exact public visibility matrix before replacing policies', () => {
		const lockPosition = migration.indexOf('LOCK TABLE\n\tpublic.level,')
		const backfillPosition = migration.indexOf(
			'INSERT INTO zc_private.level_record_count (id_level, record_count)',
		)
		const policyPosition = migration.indexOf('ALTER POLICY "graphql_select_visible_level"')

		expect(lockPosition).toBeGreaterThan(-1)
		expect(lockPosition).toBeLessThan(backfillPosition)
		expect(migration).toContain('public.record\nIN SHARE ROW EXCLUSIVE MODE')
		expect(backfillPosition).toBeGreaterThan(-1)
		expect(backfillPosition).toBeLessThan(policyPosition)
		expect(migration).toContain('candidate_level.adventure = true')
		expect(migration).toContain('FROM public.level_item AS any_level_item')
		expect(migration).toContain('candidate_level_item.deleted = false')
		expect(migration).toContain('candidate_workshop_item.visibility = 0')
		expect(migration).toContain('candidate_workshop_item.visibility = 3')
		expect(migration).toContain('COALESCE(level_records.record_count, 0) > 0')
		expect(migration).not.toMatch(/candidate_workshop_item\.visibility\s+IN\s*\([^)]*1/)
		expect(migration).not.toMatch(/candidate_workshop_item\.visibility\s+IN\s*\([^)]*2/)
	})

	test('maintains visibility synchronously for every source transition', () => {
		for (const trigger of [
			'graphql_sync_record_visibility_insert_delete',
			'graphql_sync_record_visibility_level_update',
			'graphql_sync_level_visibility_insert_delete',
			'graphql_sync_level_visibility_adventure_update',
			'graphql_sync_level_item_visibility_insert_delete',
			'graphql_sync_level_item_visibility_update',
			'graphql_sync_workshop_visibility_insert_delete',
			'graphql_sync_workshop_visibility_update',
		]) {
			expect(migration).toContain(`CREATE TRIGGER ${trigger}`)
		}

		expect(migration).toContain('SET search_path = pg_catalog')
		expect(migration).toContain('SECURITY DEFINER')
		expect(migration).toContain('RETURNING record_count INTO new_record_count')
		expect(migration).toContain('IF new_record_count = 1 THEN')
		expect(migration).toContain('old_visibility_changed := FOUND')
		expect(migration).toContain('IF old_visibility_changed OR new_visibility_changed THEN')
		expect(migration).toContain('PERFORM zc_private.sync_level_visibility(OLD.id_level)')
		expect(migration).toContain('PERFORM zc_private.sync_workshop_visibility(OLD.workshop_id)')
	})

	test('uses set-based policy inputs instead of scalar visibility helpers', () => {
		for (const allowlist of [
			'zc_private.visible_level AS graphql_visible_level',
			'zc_private.visible_level_item AS graphql_visible_level_item',
			'zc_private.visible_workshop_item AS graphql_visible_workshop_item',
			'zc_private.visible_record AS graphql_visible_record',
			'zc_private.visible_zsl_level AS graphql_visible_zsl_level',
		]) {
			expect(migration).toContain(allowlist)
		}

		const policySection = migration.slice(
			migration.indexOf('ALTER POLICY "graphql_select_visible_favourite"'),
			migration.indexOf('CREATE OR REPLACE FUNCTION zc_private.sync_workshop_visibility'),
		)
		expect(policySection).not.toContain('zc_private.is_visible_')
	})

	test('keeps public routine contracts and gates them through allowlist joins', () => {
		expect(migration).toContain('CREATE OR REPLACE FUNCTION public.hot_levels_since')
		expect(migration).toContain('INNER JOIN zc_private.visible_level AS allowed_level')
		expect(migration).toContain('CREATE OR REPLACE FUNCTION public.z_rtm(')
		expect(migration).toContain('p_excluded_author_ids bigint[] DEFAULT NULL::bigint[]')
		expect(migration).toContain('p_sample_size integer DEFAULT 50')
		expect(migration).toContain(
			'INNER JOIN zc_private.visible_level_item AS allowed_level_item',
		)
		expect(migration.match(/SECURITY INVOKER/g)).toHaveLength(2)
	})

	test('grants only public visibility state and bounds GraphQL statements', () => {
		const grant = migration.match(
			/GRANT SELECT ON TABLE(?<tables>[\s\S]*?)TO zeepcentraal_graphql;/,
		)?.groups?.tables

		expect(grant).toBeDefined()
		expect(grant).toContain('zc_private.visible_level')
		expect(grant).toContain('zc_private.visible_record')
		expect(grant).not.toContain('zc_private.level_record_count')
		expect(migration).toContain(
			"ALTER ROLE zeepcentraal_graphql SET statement_timeout TO '15s'",
		)
		expect(migration).toContain("ALTER ROLE zeepcentraal_graphql SET lock_timeout TO '3s'")
		expect(migration).toContain(
			"ALTER ROLE zeepcentraal_graphql SET idle_in_transaction_session_timeout TO '30s'",
		)
	})
})
