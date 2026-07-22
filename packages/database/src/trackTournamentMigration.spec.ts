import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const tables = readFileSync(
	new URL('../drizzle/0064_gigantic_blue_shield.sql', import.meta.url),
	'utf8',
)
const policies = readFileSync(
	new URL('../drizzle/0065_brainy_human_robot.sql', import.meta.url),
	'utf8',
)
const immutability = readFileSync(
	new URL('../drizzle/0066_wonderful_korg.sql', import.meta.url),
	'utf8',
)

describe('track tournament migrations', () => {
	test('creates format reuse, rotation, leaderboard, and cursor constraints', () => {
		expect(tables).toContain('CONSTRAINT "UQ_track_tournament_type_level"')
		expect(tables).toContain('CONSTRAINT "UQ_track_tournament_type_start"')
		expect(tables).toContain('CONSTRAINT "UQ_track_tournament_type_slug"')
		expect(tables).toContain('PRIMARY KEY("id_tournament","id_user")')
		expect(tables).toContain('("id_tournament","rank","time","id_record")')
		expect(tables).toContain('("type","id" DESC NULLS FIRST)')
		expect(immutability).toContain('REFERENCES "public"."record"("id") ON DELETE no action')
	})

	test('exposes read-only visible rows with live invalidations', () => {
		expect(tables).toContain('@behavior -insert -update -delete')
		expect(tables.match(/tg__live_query_invalidate/g)).toHaveLength(2)
		expect(tables).toContain(
			'GRANT SELECT ON TABLE public.track_tournament, public.track_tournament_result',
		)
		expect(policies).toContain('ENABLE ROW LEVEL SECURITY')
		expect(policies).toContain('graphql_select_visible_track_tournament')
		expect(policies).toContain('graphql_visible_level.publicly_visible = true')
		expect(policies).toContain('graphql_record_level.publicly_visible = true')
	})
})
