import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('./levelPoints.ts', import.meta.url), 'utf8')
const schema = readFileSync(new URL('../schema.ts', import.meta.url), 'utf8')

describe('level point persistence', () => {
	test('persists every telemetry capability sample size', () => {
		for (const field of [
			'airSampleSize',
			'wheelSampleSize',
			'slipSampleSize',
			'ragdollSampleSize',
		]) {
			expect(schema).toContain(`${field}: integer(`)
			expect(service).toContain(`${field}: null`)
			expect(service).toContain(`${field}: sql\`excluded.`)
		}
	})

	test('detects null-safe changes across complete score rows', () => {
		expect(service.match(/to_jsonb\(/g)).toHaveLength(4)
		expect(service.match(/IS DISTINCT FROM/g)).toHaveLength(2)
		expect(service).toContain("- 'id_level' - 'date_created' - 'date_updated'")
		expect(service).toContain("- 'id' - 'id_level' - 'date_created' - 'date_updated'")
		expect(service).not.toContain('levelPoints.points, latestHistory.points')
	})

	test('sanitizes PostgreSQL real values on bulk and single upserts', () => {
		expect(service.match(/sanitizeLevelPointRealValues/g)).toHaveLength(3)
		expect(service).toContain(
			'payloads.map((payload) => sanitizeLevelPointRealValues({ ...payload, dateUpdated }))',
		)
		expect(service).toContain(
			'const { idLevel, ...values } = sanitizeLevelPointRealValues({ ...payload, dateUpdated })',
		)
	})
})
