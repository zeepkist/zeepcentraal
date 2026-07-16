import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
	new URL('../drizzle/0051_broken_ravenous.sql', import.meta.url),
	'utf8',
)

describe('web GraphQL query index migration', () => {
	test('installs trigram support before creating search indexes', () => {
		const extension = migration.indexOf('CREATE EXTENSION IF NOT EXISTS pg_trgm')
		expect(extension).toBeGreaterThanOrEqual(0)

		const ginIndexes = [...migration.matchAll(/^CREATE INDEX.*USING gin.*$/gm)]
		expect(ginIndexes).toHaveLength(4)
		for (const match of ginIndexes) {
			expect(match.index).toBeGreaterThan(extension)
			expect(match[0]).toContain('gin_trgm_ops')
		}
	})

	test('creates replacement record indexes before dropping old coverage', () => {
		const replacements = [
			['IX_records_date_created_id', 'IX_records_date_created'],
			['IX_records_user_date_created_id', 'IX_records_user_date_created'],
		] as const

		for (const [replacement, superseded] of replacements) {
			const create = migration.indexOf(`CREATE INDEX "${replacement}"`)
			const drop = migration.indexOf(`DROP INDEX "${superseded}"`)
			expect(create).toBeGreaterThanOrEqual(0)
			expect(drop).toBeGreaterThan(create)
		}
		expect(migration.indexOf('DROP INDEX')).toBeGreaterThan(
			migration.lastIndexOf('CREATE INDEX'),
		)
	})

	test('uses transactional non-unique index statements with Drizzle breakpoints', () => {
		expect(migration).not.toContain('CONCURRENTLY')
		expect(migration).not.toContain('CREATE UNIQUE INDEX')
		expect(migration.match(/CREATE INDEX/g)).toHaveLength(24)
		expect(migration.match(/--> statement-breakpoint/g)?.length).toBeGreaterThanOrEqual(26)
	})
})
