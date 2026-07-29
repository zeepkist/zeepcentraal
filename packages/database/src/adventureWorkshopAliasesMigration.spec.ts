import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
	new URL('../drizzle/0070_preserve_adventure_workshop_aliases.sql', import.meta.url),
	'utf8',
)

describe('Adventure Workshop alias repair migration', () => {
	test('restores only deleted level items belonging to Adventure levels', () => {
		expect(migration).toContain('UPDATE public.level_item AS adventure_level_item')
		expect(migration).toContain('FROM public.level AS adventure_level')
		expect(migration).toContain('adventure_level.id = adventure_level_item.id_level')
		expect(migration).toContain('adventure_level.adventure = true')
		expect(migration).toContain('adventure_level_item.deleted = true')
		expect(migration).toContain('deleted = false')
	})
})
