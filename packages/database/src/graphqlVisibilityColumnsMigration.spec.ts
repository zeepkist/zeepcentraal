import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../drizzle/0056_fair_famine.sql', import.meta.url), 'utf8')

describe('GraphQL persisted visibility migration', () => {
	test('adds fail-closed state and backfills it before policy replacement', () => {
		for (const column of [
			'public.level ADD COLUMN has_records',
			'public.level ADD COLUMN publicly_visible',
			'public.level_item ADD COLUMN publicly_visible',
			'public.level_metadata ADD COLUMN publicly_visible',
			'public.workshop_item ADD COLUMN publicly_visible',
		]) {
			expect(migration).toContain(`${column} boolean DEFAULT false NOT NULL`)
		}

		const lockPosition = migration.indexOf('LOCK TABLE')
		const adventureRepairPosition = migration.indexOf(
			'UPDATE public.level AS candidate_level\nSET\n\tadventure = true',
		)
		const recordBackfillPosition = migration.indexOf(
			'UPDATE public.level AS candidate_level\nSET has_records',
		)
		const policyPosition = migration.indexOf('ALTER POLICY graphql_select_visible_level_item')
		expect(lockPosition).toBeGreaterThan(-1)
		expect(lockPosition).toBeLessThan(adventureRepairPosition)
		expect(adventureRepairPosition).toBeLessThan(recordBackfillPosition)
		expect(recordBackfillPosition).toBeLessThan(policyPosition)
		expect(migration).toContain('official_adventure_item.workshop_id = -1')
		expect(migration).toContain('official_adventure_item.author_id = 76561198041027402')
		expect(migration).toContain('candidate_level_item.deleted = false')
		expect(migration).toContain('candidate_level.adventure = true')
		expect(migration).toContain('candidate_workshop_item.visibility = 0')
		expect(migration).toContain('candidate_workshop_item.visibility = 3')
		expect(migration).toContain('candidate_level.has_records = true')
	})

	test('uses direct boolean RLS only for sensitive metadata', () => {
		for (const table of ['level_item', 'level_metadata', 'workshop_item']) {
			expect(migration).toContain(`ALTER POLICY graphql_select_visible_${table}`)
		}
		expect(migration.match(/USING \(publicly_visible = true\)/g)).toHaveLength(3)

		for (const table of [
			'favourite',
			'level',
			'level_points',
			'level_points_history',
			'personal_best_global',
			'record',
			'record_media',
			'record_statistic',
			'user_point_contribution',
			'vote',
			'world_record_global',
			'zsl_level',
			'zsl_level_result',
		]) {
			expect(migration).toContain(`ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY`)
		}

		expect(migration).not.toContain('ALTER TABLE public.level_item DISABLE ROW LEVEL SECURITY')
		expect(migration).not.toContain(
			'ALTER TABLE public.level_metadata DISABLE ROW LEVEL SECURITY',
		)
		expect(migration).not.toContain(
			'ALTER TABLE public.workshop_item DISABLE ROW LEVEL SECURITY',
		)
	})

	test('makes record visibility sticky without serializing established levels', () => {
		const triggerBody = migration.slice(
			migration.indexOf('CREATE OR REPLACE FUNCTION zc_private.tg_mark_level_has_records'),
			migration.indexOf(
				'ALTER FUNCTION zc_private.tg_mark_level_has_records() OWNER TO CURRENT_USER',
			),
		)
		const fastExit = triggerBody.indexOf('candidate_level.has_records = true')
		const workshopLock = triggerBody.indexOf('FOR UPDATE OF candidate_workshop_item')
		expect(fastExit).toBeGreaterThan(-1)
		expect(fastExit).toBeLessThan(workshopLock)
		expect(triggerBody).toContain('SET has_records = true')
		expect(triggerBody).toContain('AND has_records = false')
		expect(migration).toContain('AFTER INSERT ON public.record')
		expect(migration).toContain('AFTER UPDATE OF id_level ON public.record')
		expect(migration).not.toContain('AFTER INSERT OR DELETE ON public.record')
		expect(migration).not.toContain('SET has_records = false')
	})

	test('recomputes a Workshop visibility change with bounded set-based updates', () => {
		const triggerBody = migration.slice(
			migration.indexOf(
				'CREATE OR REPLACE FUNCTION zc_private.tg_sync_public_workshop_visibility',
			),
			migration.indexOf(
				'ALTER FUNCTION zc_private.tg_sync_public_workshop_visibility() OWNER TO CURRENT_USER',
			),
		)
		const levelLock = triggerBody.indexOf('FOR UPDATE OF candidate_level')
		const itemUpdate = triggerBody.indexOf('UPDATE public.level_item AS candidate_level_item')
		expect(triggerBody).toContain('ORDER BY candidate_level.id')
		expect(levelLock).toBeGreaterThan(-1)
		expect(itemUpdate).toBeGreaterThan(levelLock)
		expect(triggerBody).toContain('UPDATE public.level_item AS candidate_level_item')
		expect(triggerBody).toContain('UPDATE public.level AS candidate_level')
		expect(triggerBody).toContain('UPDATE public.level_metadata AS candidate_level_metadata')
		expect(triggerBody).toContain(
			'PERFORM zc_private.sync_public_workshop_visibility(NEW.workshop_id)',
		)
		expect(
			triggerBody.match(
				/PERFORM zc_private\.sync_public_workshop_visibility\(NEW\.workshop_id\)/g,
			),
		).toHaveLength(1)
		expect(triggerBody).not.toContain('FOR affected_level_id IN')
		expect(triggerBody).not.toContain('sync_public_level_visibility(affected_level_id)')
	})

	test('serializes every level summary refresh even when its value is unchanged', () => {
		const functionBody = migration.slice(
			migration.indexOf('CREATE OR REPLACE FUNCTION zc_private.sync_public_level_summary'),
			migration.indexOf(
				'ALTER FUNCTION zc_private.sync_public_level_summary(integer) OWNER TO CURRENT_USER',
			),
		)
		const levelLock = functionBody.indexOf('FOR UPDATE OF candidate_level')
		const levelUpdate = functionBody.indexOf('UPDATE public.level AS candidate_level')

		expect(functionBody).toContain('WHERE candidate_level.id = p_level_id')
		expect(levelLock).toBeGreaterThan(-1)
		expect(levelUpdate).toBeGreaterThan(levelLock)
	})

	test('level-item writes update only their alias and aggregate parent state', () => {
		const setterBody = migration.slice(
			migration.indexOf(
				'CREATE OR REPLACE FUNCTION zc_private.tg_set_public_level_item_visibility',
			),
			migration.indexOf(
				'ALTER FUNCTION zc_private.tg_set_public_level_item_visibility() OWNER TO CURRENT_USER',
			),
		)
		const parentBody = migration.slice(
			migration.indexOf(
				'CREATE OR REPLACE FUNCTION zc_private.tg_sync_public_level_item_parents',
			),
			migration.indexOf(
				'ALTER FUNCTION zc_private.tg_sync_public_level_item_parents() OWNER TO CURRENT_USER',
			),
		)

		expect(setterBody).toContain('NEW.publicly_visible := COALESCE')
		expect(setterBody).not.toContain('UPDATE public.level_item')
		expect(parentBody).toContain('sync_public_level_summary')
		expect(parentBody).toContain('sync_public_workshop_visibility')
		expect(parentBody).not.toContain('sync_public_level_visibility')
		expect(parentBody).not.toContain('UPDATE public.level_item')
		expect(migration).toContain(
			'BEFORE INSERT OR UPDATE OF id_level, workshop_id, deleted ON public.level_item',
		)
	})

	test('keeps routines restricted to public discovery rows', () => {
		expect(migration).toContain('CREATE OR REPLACE FUNCTION public.hot_levels_since')
		expect(migration).toContain('visible_level.publicly_visible = true')
		expect(migration).toContain('CREATE OR REPLACE FUNCTION public.z_rtm(')
		expect(migration).toContain('visible_level_item.publicly_visible = true')
		expect(migration).toContain('AND visible_level_item.deleted = false')
		expect(migration.match(/SECURITY INVOKER/g)).toHaveLength(2)
		expect(migration).not.toContain('INNER JOIN zc_private.visible_level AS allowed_level')
		expect(migration).not.toContain(
			'INNER JOIN zc_private.visible_level_item AS allowed_level_item',
		)
	})

	test('hides internal state and removes obsolete allowlists last', () => {
		for (const column of [
			'public.level.has_records',
			'public.level_item.publicly_visible',
			'public.level_metadata.publicly_visible',
			'public.workshop_item.publicly_visible',
		]) {
			expect(migration).toContain(
				`COMMENT ON COLUMN ${column} IS E'@omit\\n@behavior -aggregate -groupBy -havingBy'`,
			)
		}
		expect(migration).not.toContain(
			"COMMENT ON COLUMN public.level.publicly_visible IS E'@omit'",
		)

		const policyPosition = migration.indexOf('ALTER POLICY graphql_select_visible_level_item')
		const cleanupPosition = migration.indexOf(
			'DROP TABLE IF EXISTS zc_private.level_record_count',
		)
		expect(cleanupPosition).toBeGreaterThan(policyPosition)
		for (const object of [
			'zc_private.level_record_count',
			'zc_private.visible_level',
			'zc_private.visible_level_item',
			'zc_private.visible_workshop_item',
		]) {
			expect(migration).toContain(`DROP TABLE IF EXISTS ${object}`)
		}
	})
})
