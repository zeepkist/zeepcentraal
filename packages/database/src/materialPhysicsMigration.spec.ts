import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(import.meta.dir, '../drizzle/0069_pink_steel_serpent.sql'), 'utf8')

describe('material physics statistics migration', () => {
	test('merges V6 particle statistics into matching physics categories', () => {
		expect(sql).toContain('COALESCE("distance_on_metal", 0)')
		expect(sql).toContain('COALESCE("distance_on_wood", 0)')
		expect(sql).toContain('COALESCE("distance_on_snow", 0)')
		expect(sql).toContain('COALESCE("distance_on_flesh", 0)')
		expect(sql).toContain('"distance_on_wood" = NULL')
		expect(sql).toContain('WHERE "ghost_version" = 6')
	})

	test('preserves nulls while merging nullable statistics', () => {
		expect(sql).toContain(
			'WHEN "distance_on_sand" IS NULL AND "distance_on_snow" IS NULL THEN NULL',
		)
		expect(sql).toContain(
			'WHEN "distance_on_mud" IS NULL AND "distance_on_flesh" IS NULL THEN NULL',
		)
		expect(sql).toContain('"distance_on_tarmac" IS NULL')
		expect(sql).toContain('"distance_on_metal" IS NULL')
		expect(sql).toContain('"distance_on_wood" IS NULL')
	})

	test('renames Ice1, adds stronger ice variants, and removes particle columns', () => {
		expect(sql).toContain('RENAME COLUMN "distance_on_ice" TO "distance_on_ice1"')
		expect(sql).toContain('ADD COLUMN "distance_on_ice2" real')
		expect(sql).toContain('ADD COLUMN "distance_on_ice3" real')
		expect(sql).toContain('DROP COLUMN "distance_on_snow"')
		expect(sql).toContain('DROP COLUMN "distance_on_metal"')
		expect(sql).toContain('DROP COLUMN "distance_on_flesh"')
	})
})
