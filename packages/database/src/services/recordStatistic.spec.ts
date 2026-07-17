import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

let whereCondition: SQL | undefined
let conflictSet: Record<string, unknown> | undefined

function createSelectBuilder() {
	const builder = {
		from: mock(() => builder),
		leftJoin: mock(() => builder),
		where: mock((condition: SQL) => {
			whereCondition = condition
			return builder
		}),
		orderBy: mock(() => builder),
		limit: mock(async () => []),
	}
	return builder
}

function createInsertBuilder() {
	const builder = {
		values: mock(() => builder),
		onConflictDoUpdate: mock(async ({ set }: { set: Record<string, unknown> }) => {
			conflictSet = set
		}),
	}
	return builder
}

const db = {
	select: mock(() => createSelectBuilder()),
	insert: mock(() => createInsertBuilder()),
}

mock.module('../client', () => ({ db }))

const { getRecordMediaForStatisticBackfill, upsertRecordStatistic } = await import(
	'./recordStatistic'
)

describe('record statistic backfill selection', () => {
	beforeEach(() => {
		whereCondition = undefined
		conflictSet = undefined
		db.select.mockClear()
		db.insert.mockClear()
	})

	test('selects absent or incomplete statistics without treating unsupported values as missing', async () => {
		await getRecordMediaForStatisticBackfill({ limit: 500, afterId: 10 })

		const query = new PgDialect().sqlToQuery(whereCondition as SQL)
		expect(query.sql).toContain('"record_statistic"."id_record" is null')
		expect(query.sql).toContain('"record_statistic"."ghost_version" is null')
		expect(query.sql).toContain('"record_statistic"."has_input_data" is null')
		expect(query.sql).toContain('"record_statistic"."has_ragdoll_data" is null')
		expect(query.sql).toContain('"record_statistic"."has_input_data" =')
		expect(query.sql).toContain('"record_statistic"."time_any_driver_input" is null')
		expect(query.sql).toContain('"record_statistic"."driver_input_transition_count" is null')
		expect(query.sql).not.toContain('"record_statistic"."distance_in_air" is null')
		expect(query.sql).toContain('"record_media"."id_record" >')
	})

	test('targeted selection forces requested records regardless of completeness', async () => {
		await getRecordMediaForStatisticBackfill({ limit: 2, ids: [3, 7] })

		const query = new PgDialect().sqlToQuery(whereCondition as SQL)
		expect(query.sql).toContain('"record_media"."id_record" in')
		expect(query.sql).not.toContain('"record_statistic"."ghost_version" is null')
		expect(query.params).toEqual(expect.arrayContaining([3, 7]))
	})

	test('upsert refreshes provenance, capabilities, and driver input metrics', async () => {
		await upsertRecordStatistic({
			idRecord: 42,
			ghostVersion: 6,
			hasInputData: true,
			hasAirData: true,
			hasWheelData: true,
			hasSlipData: true,
			hasStateData: true,
			hasSurfaceData: true,
			hasVelocityData: true,
			hasRagdollData: true,
			timeAnyDriverInput: 12.5,
			driverInputTransitionCount: 18,
		})

		expect(conflictSet).toMatchObject({
			ghostVersion: 6,
			hasInputData: true,
			hasAirData: true,
			hasWheelData: true,
			hasSlipData: true,
			hasStateData: true,
			hasSurfaceData: true,
			hasVelocityData: true,
			hasRagdollData: true,
			timeAnyDriverInput: 12.5,
			driverInputTransitionCount: 18,
		})
	})
})
