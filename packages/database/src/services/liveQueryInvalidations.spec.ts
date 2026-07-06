import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

describe('live query invalidation migration', () => {
	test('creates metadata-only invalidation triggers and excludes auth', async () => {
		const sql = await readFile(
			join(import.meta.dir, '../../drizzle/0048_live_query_invalidations.sql'),
			'utf8',
		)

		expect(sql).toContain('CREATE TABLE "live_query_invalidations"')
		expect(sql).toContain('COMMENT ON TABLE "live_query_invalidations" IS E\'@omit\'')
		expect(sql).toContain('TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP')
		expect(sql).toContain('ON "record"')
		expect(sql).toContain('ON "user"')
		expect(sql).not.toContain('ON "auth"')
	})
})
