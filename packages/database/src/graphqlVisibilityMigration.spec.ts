import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
	new URL('../drizzle/0054_early_millenium_guard.sql', import.meta.url),
	'utf8',
)

describe('GraphQL level visibility migration', () => {
	test('creates a hardened login role without embedding credentials', () => {
		expect(migration).toContain('CREATE ROLE zeepcentraal_graphql')
		for (const attribute of [
			'LOGIN',
			'NOSUPERUSER',
			'NOCREATEDB',
			'NOCREATEROLE',
			'NOINHERIT',
			'NOREPLICATION',
			'NOBYPASSRLS',
		]) {
			expect(migration).toContain(attribute)
		}
		expect(migration.toLowerCase()).not.toContain('password')
	})

	test('defines private, owner-backed visibility predicates', () => {
		for (const helper of [
			'is_visible_level',
			'is_visible_level_item',
			'is_visible_workshop_item',
			'is_visible_record',
			'is_visible_zsl_level',
		]) {
			expect(migration).toContain(`CREATE OR REPLACE FUNCTION zc_private.${helper}`)
			expect(migration).toContain(`GRANT EXECUTE ON FUNCTION zc_private.${helper}`)
		}

		expect(migration).toContain('SECURITY DEFINER')
		expect(migration).toContain('SET search_path = pg_catalog')
		expect(migration).toContain('ALTER SCHEMA zc_private OWNER TO CURRENT_USER')
		for (const helper of [
			'is_visible_level(integer)',
			'is_visible_level_item(integer)',
			'is_visible_workshop_item(bigint)',
			'is_visible_record(integer)',
			'is_visible_zsl_level(integer)',
		]) {
			expect(migration).toContain(`ALTER FUNCTION zc_private.${helper} OWNER TO CURRENT_USER`)
		}
		expect(migration).toContain('visible_level.adventure = true')
		expect(migration).toContain('visible_workshop_item.visibility = 0')
		expect(migration).toContain('visible_workshop_item.visibility = 3')
		expect(migration).toContain('FROM public.record AS submitted_record')
		expect(migration).toContain('visible_level_item.deleted = false')
		expect(migration).toContain('FROM public.level_item AS any_level_item')
		expect(migration).toMatch(
			/FROM public\.workshop_item AS visible_workshop_item[\s\S]*?AND EXISTS \([\s\S]*?FROM public\.level_item AS visible_level_item[\s\S]*?visible_level_item\.deleted = false/,
		)
		expect(migration).not.toContain('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA zc_private')
	})

	test('applies SELECT policies to every level-derived GraphQL table', () => {
		const protectedTables = [
			'favourite',
			'level',
			'level_item',
			'level_metadata',
			'level_points',
			'level_points_history',
			'personal_best_global',
			'record',
			'record_media',
			'record_statistic',
			'user_point_contribution',
			'vote',
			'workshop_item',
			'world_record_global',
			'zsl_level',
			'zsl_level_result',
		]

		for (const table of protectedTables) {
			expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
			expect(migration).toContain(`ON public.${table}`)
		}

		expect(migration).not.toContain('FORCE ROW LEVEL SECURITY')
		expect(
			migration.indexOf('CREATE OR REPLACE FUNCTION zc_private.is_visible_level'),
		).toBeLessThan(migration.indexOf('CREATE POLICY graphql_select_visible_level'))
	})

	test('gates public level routines while preserving current zRtm contract', () => {
		expect(migration).toContain('CREATE OR REPLACE FUNCTION public.hot_levels_since')
		expect(migration).toContain('zc_private.is_visible_level(visible_level.id)')
		expect(migration).toContain('CREATE OR REPLACE FUNCTION public.z_rtm(')
		expect(migration).toContain('p_excluded_author_ids bigint[] DEFAULT NULL::bigint[]')
		expect(migration).toContain('p_min_points integer DEFAULT NULL::integer')
		expect(migration).toContain('p_max_points integer DEFAULT NULL::integer')
		expect(migration).toContain('p_sample_size integer DEFAULT 50')
		expect(migration).toContain('num_records bigint')
		expect(migration).toContain('points integer')
		expect(migration).toContain('zc_private.is_visible_level_item(visible_level_item.id)')
		expect(migration.match(/SECURITY INVOKER/g)).toHaveLength(2)
		expect(migration).toContain(
			'REVOKE EXECUTE ON FUNCTION public.hot_levels_since(timestamptz) FROM PUBLIC',
		)
		expect(migration).toContain(
			'GRANT EXECUTE ON FUNCTION public.hot_levels_since(timestamptz) TO zeepcentraal_graphql',
		)
	})

	test('grants only public GraphQL data and live-query maintenance access', () => {
		const tableGrant = migration.match(
			/GRANT SELECT ON TABLE(?<tables>[\s\S]*?)TO zeepcentraal_graphql;/,
		)?.groups?.tables

		expect(tableGrant).toBeDefined()
		expect(tableGrant).not.toContain('public.auth')
		expect(tableGrant).not.toContain('public.level_request')
		expect(migration).toContain(
			'GRANT SELECT, DELETE ON TABLE public.live_query_invalidations TO zeepcentraal_graphql',
		)
		expect(migration).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
		expect(migration).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC')
		expect(migration).toContain(
			'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC',
		)
		expect(migration).not.toContain('ALTER TABLE public.auth ENABLE ROW LEVEL SECURITY')
		expect(migration).not.toContain(
			'ALTER TABLE public.level_request ENABLE ROW LEVEL SECURITY',
		)
		expect(migration).toContain(
			'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
		)
		expect(migration).toContain(
			'REVOKE EXECUTE ON FUNCTION public.tg__live_query_invalidate() FROM PUBLIC',
		)
	})
})
