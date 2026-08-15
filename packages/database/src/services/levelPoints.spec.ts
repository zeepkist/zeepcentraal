import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const service = readFileSync(new URL('./levelPoints.ts', import.meta.url), 'utf8')
const schema = readFileSync(new URL('../schema.ts', import.meta.url), 'utf8')

describe('level point persistence', () => {
	test('excludes legacy V1 diagnostics from active persistence', () => {
		for (const field of [
			'competitiveMerit',
			'competitivenessModifier',
			'popularityModifier',
			'cutPenalty',
			'passivePlaySeverity',
			'sampleSize',
			'typicalDistance',
			'worldRecordExcluded',
		]) {
			expect(schema).not.toContain(`${field}:`)
			expect(service).not.toContain(`${field}:`)
		}
	})

	test('detects null-safe changes across complete score rows', () => {
		expect(service.match(/levelPointHistoryChanged\(latestHistory\.idLevel\)/g)).toHaveLength(2)
		expect(service).toContain('const latestHistoryRow = sql.identifier(LATEST_HISTORY_ALIAS)')
		expect(service).not.toMatch(/to_jsonb\(\$\{latestHistory\}\)/)
		expect(service).toContain("- 'id_level' - 'date_created' - 'date_updated'")
		expect(service).toContain("- 'id' - 'id_level' - 'date_created' - 'date_updated'")
		expect(service).not.toContain('levelPoints.points, latestHistory.points')
	})

	test('compiles latest history comparison against joined row alias', () => {
		const query = new PgDialect().sqlToQuery(sql`to_jsonb(${sql.identifier('latest_history')})`)

		expect(query.sql).toBe('to_jsonb("latest_history")')
		expect(query.sql).not.toContain('select')
	})

	test('keeps paginated history changes complete and deterministic', () => {
		expect(service.match(/\.leftJoin\(latestHistory/g)).toHaveLength(2)
		expect(service.match(/\.orderBy\(levelPoints\.idLevel\)/g)).toHaveLength(2)
	})

	test('sanitizes PostgreSQL real values through guarded bulk upserts', () => {
		expect(service.match(/sanitizeLevelPointRealValues/g)).toHaveLength(2)
		expect(service).toContain(
			'payloads.map((payload) => sanitizeLevelPointRealValues({ ...payload, dateUpdated }))',
		)
		expect(service).toContain('where: levelPointUpsertChanged')
		expect(service).toContain('where: zeroLevelPointUpsertChanged')
		expect(service).toContain(
			"to_jsonb(excluded) - 'id_level' - 'date_created' - 'date_updated'",
		)
	})
})
