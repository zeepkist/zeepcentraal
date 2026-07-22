import { describe, expect, mock, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../schema'

const db = drizzle.mock({ schema })

mock.module('../client', () => ({ db }))
mock.module('../config', () => ({ GHOST_FOLDER: 'ghost' }))
mock.module('../s3', () => ({
	deleteFile: mock(async () => {}),
	uploadFile: mock(async () => {}),
}))
mock.module('@zeepkist/telemetry', () => ({
	createCounter: () => ({ add: () => {} }),
	recordSpanError: () => {},
	setActiveSpanErrorStatus: () => {},
	startActiveSpan: (_name: string, callback: (span: Record<string, () => void>) => unknown) =>
		callback({
			recordException: () => {},
			setErrorStatus: () => {},
			end: () => {},
		}),
}))

const { buildPersonalBestsWithRecordByLevelIdsQuery, buildV2ScorePersonalBestsByLevelIdsQuery } =
	await import('./record')

describe('level score personal best query', () => {
	test('aliases statistic duration separately from record time', () => {
		const query = buildPersonalBestsWithRecordByLevelIdsQuery({
			idLevels: [1],
			limit: 50,
		}).toSQL()

		expect(query.sql).toContain('"record_statistic"."time" as "statistic_time"')
		expect(query.sql).toContain('"speeds", "statistic_time", "distance"')
		expect(query.sql).not.toContain('"speeds", "time", "distance"')
	})

	test('limits before joining only V2 input telemetry', () => {
		const query = buildV2ScorePersonalBestsByLevelIdsQuery({
			idLevels: [1],
			limit: 50,
		}).toSQL().sql

		expect(query).toContain('ranked_v2_score_personal_bests')
		expect(query).toContain('left join "record_statistic"')
		expect(query).toContain('"driver_input_transition_count"')
		expect(query).toContain('"has_input_data"')
		for (const excluded of [
			'"speeds"',
			'"distance"',
			'"average_speed"',
			'"time_in_air"',
			'"time_on_tarmac"',
			'"has_surface_data"',
		]) {
			expect(query).not.toContain(excluded)
		}
	})
})

describe('record submission transaction', () => {
	const source = Bun.file(new URL('./record.ts', import.meta.url)).text()

	test('uses ordered shared level locking and conditional PB/WR upserts', async () => {
		const text = await source
		expect(text).toContain('WITH user_lock AS MATERIALIZED')
		expect(text).toContain('pg_advisory_xact_lock_shared(0, $' + '{input.idLevel})')
		expect(text).toContain('FROM level_lock')
		expect(text).toContain('WHERE current_record.id = $' + '{personalBestGlobal.idRecord}')
		expect(text).toContain('WHERE current_record.id = $' + '{worldRecordGlobal.idRecord}')
		expect(text).not.toContain('existingPersonalBest')
		expect(text).not.toContain('existingWorldRecord')
	})
})
