import { describe, expect, mock, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sql'
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
			setAttribute: () => {},
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
		}).toSQL()

		expect(query.sql).toContain('ranked_v2_score_personal_bests')
		expect(query.sql).toContain('left join "record_statistic"')
		expect(query.sql).toContain('"driver_input_transition_count"')
		expect(query.sql).toContain('"has_input_data"')
		for (const excluded of [
			'"date_created"',
			'"speeds"',
			'"distance"',
			'"average_speed"',
			'"time_in_air"',
			'"time_on_tarmac"',
			'"has_surface_data"',
		]) {
			expect(query.sql).not.toContain(excluded)
		}
		expect(query.sql).toContain('"splits"')
		expect(query.params).toContain(20)
	})
})

describe('record submission transaction', () => {
	const source = Bun.file(new URL('./record.ts', import.meta.url)).text()

	test('separates record, tournament, score, and world-record lock domains', async () => {
		const text = await source
		expect(text).toContain('record.submit.user_level_lock_wait')
		expect(text).toContain('pg_advisory_xact_lock($' + '{input.idUser}, $' + '{input.idLevel})')
		expect(text).toContain('pg_advisory_xact_lock_shared(0, $' + '{input.idLevel})')
		expect(text).toContain('record.submit.world_record_lock_wait')
		expect(text).toContain('pg_advisory_xact_lock($' + '{WORLD_RECORD_LOCK_NAMESPACE}')
		expect(text).toContain('record.submit.world_record_count_lock_wait')
		expect(text).toContain('lockWorldRecordCounts(tx, worldRecordUserIds)')
		expect(text).not.toContain('record.submit.user_score_lock_wait')
		expect(text).not.toContain('pg_advisory_xact_lock(0, $' + '{input.idLevel})')
		expect(text).toContain('WHERE current_record.id = $' + '{personalBestGlobal.idRecord}')
		expect(text).toContain('WHERE current_record.id = $' + '{worldRecordGlobal.idRecord}')
		expect(text).not.toContain('existingPersonalBest')
	})
})
