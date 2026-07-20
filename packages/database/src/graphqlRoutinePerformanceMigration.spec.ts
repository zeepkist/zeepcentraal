import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
	new URL('../drizzle/0057_broad_swordsman.sql', import.meta.url),
	'utf8',
)

const zRtmBody = migration.slice(
	migration.indexOf('CREATE OR REPLACE FUNCTION public.z_rtm('),
	migration.indexOf('ALTER FUNCTION public.z_rtm('),
)

describe('GraphQL public-level routine performance migration', () => {
	test('adds hidden persisted state and supporting indexes before replacing routines', () => {
		expect(migration).toContain(
			'ALTER TABLE public.level ADD COLUMN record_count bigint DEFAULT 0 NOT NULL',
		)
		expect(migration).toContain(
			'ALTER TABLE public.level_item ADD COLUMN rtm_sample_key double precision DEFAULT random() NOT NULL',
		)
		for (const column of ['public.level.record_count', 'public.level_item.rtm_sample_key']) {
			expect(migration).toContain(
				`COMMENT ON COLUMN ${column} IS E'@omit\\n@behavior -aggregate -groupBy -havingBy'`,
			)
		}
		expect(migration).toContain(
			'CREATE INDEX "IX_level_item_public_rtm_sample" ON public.level_item USING btree (rtm_sample_key, id) WHERE publicly_visible = true AND deleted = false',
		)
		expect(migration).toContain(
			'CREATE INDEX "IX_records_hot_levels_date_level" ON public.record USING btree (date_created DESC NULLS LAST, id_level)',
		)
		expect(migration).toContain(
			'SET\n\trecord_count = record_counts.record_count,\n\thas_records = true',
		)

		const lockPosition = migration.indexOf('LOCK TABLE')
		const backfillPosition = migration.indexOf('record_count = record_counts.record_count')
		const triggerPosition = migration.indexOf(
			'CREATE OR REPLACE FUNCTION zc_private.tg_sync_level_record_count()',
		)
		const routinePosition = migration.indexOf(
			'CREATE OR REPLACE FUNCTION public.hot_levels_since',
		)
		expect(lockPosition).toBeGreaterThan(-1)
		expect(lockPosition).toBeLessThan(backfillPosition)
		expect(backfillPosition).toBeLessThan(triggerPosition)
		expect(triggerPosition).toBeLessThan(routinePosition)
	})

	test('maintains exact counts while retaining sticky record visibility', () => {
		const triggerBody = migration.slice(
			migration.indexOf('CREATE OR REPLACE FUNCTION zc_private.tg_sync_level_record_count()'),
			migration.indexOf(
				'ALTER FUNCTION zc_private.tg_sync_level_record_count() OWNER TO CURRENT_USER',
			),
		)

		expect(triggerBody).toContain('record_count = record_count + 1')
		expect(triggerBody).toContain('record_count = GREATEST(record_count - 1, 0)')
		expect(triggerBody).toContain('has_records = true')
		expect(triggerBody).not.toContain('SET has_records = false')
		expect(triggerBody).toContain('ORDER BY candidate_level_item.workshop_id')
		expect(triggerBody).toContain('ORDER BY candidate_level.candidate_level_id')
		expect(migration).toContain('FOR NO KEY UPDATE OF candidate_level')
		expect(migration).toContain('AFTER INSERT ON public.record')
		expect(migration).toContain('AFTER DELETE ON public.record')
		expect(migration).toContain('AFTER UPDATE OF id_level ON public.record')
	})

	test('gates and aggregates hot levels from public level ids first', () => {
		const hotLevelsBody = migration.slice(
			migration.indexOf('CREATE OR REPLACE FUNCTION public.hot_levels_since'),
			migration.indexOf('CREATE OR REPLACE FUNCTION public.z_rtm('),
		)

		expect(hotLevelsBody).toContain('public_level_ids AS MATERIALIZED')
		expect(hotLevelsBody).toContain('candidate_level.publicly_visible = true')
		expect(hotLevelsBody).toContain('INNER JOIN public.record AS submitted_record')
		expect(hotLevelsBody).toContain('submitted_record.date_created >= "since"')
		expect(hotLevelsBody).toContain('SECURITY INVOKER')
		expect(hotLevelsBody).not.toContain('public.level_item')
		expect(hotLevelsBody).not.toContain('public.level_metadata')
		expect(hotLevelsBody).not.toContain('public.workshop_item')
	})

	test('uses hardened indexed circular sampling without request-time record counts', () => {
		expect(zRtmBody).toContain('SECURITY DEFINER')
		expect(zRtmBody).toContain('ROWS 50')
		expect(zRtmBody).toContain('SET search_path = pg_catalog, pg_temp')
		expect(zRtmBody).toContain('SET row_security = off')
		expect(zRtmBody).toContain('visible_level.publicly_visible = true')
		expect(zRtmBody).toContain('visible_level_item.publicly_visible = true')
		expect(zRtmBody).toContain('visible_level_metadata.publicly_visible = true')
		expect(zRtmBody).toContain('visible_level.record_count AS num_records')
		expect(zRtmBody).toContain('rtm_sample_key >= sample_pivot')
		expect(zRtmBody).toContain('rtm_sample_key < sample_pivot')
		expect(zRtmBody).toContain('selected_candidates AS MATERIALIZED')
		expect(zRtmBody).not.toContain('ORDER BY pg_catalog.random()')
		expect(zRtmBody).not.toContain('FROM public.record AS submitted_record')
		expect(zRtmBody).not.toContain('count(*) AS num_records')
	})

	test('keeps definer execution restricted to the GraphQL role', () => {
		expect(migration).toContain(
			') FROM PUBLIC, zeepcentraal_graphql;--> statement-breakpoint\nGRANT EXECUTE ON FUNCTION public.hot_levels_since',
		)
		expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.z_rtm(')
	})
})
