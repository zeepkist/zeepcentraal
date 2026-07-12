import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
	new URL('../drizzle/0050_hot_levels_since.sql', import.meta.url),
	'utf8',
)

describe('hot levels migration', () => {
	it('returns exact levels ordered by weekly record count', () => {
		expect(migration).toContain('CREATE FUNCTION public.hot_levels_since')
		expect(migration).toContain('RETURNS SETOF public.level')
		expect(migration).toContain('public.record.date_created >= "since"')
		expect(migration).toContain('public.level_item.deleted = false')
		expect(migration).toContain('ORDER BY count(public.record.id) DESC, public.level.id ASC')
		expect(migration).toContain('STABLE')
		expect(migration).toContain('PARALLEL SAFE')
	})
})
