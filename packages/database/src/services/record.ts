import {
	createCounter,
	recordSpanError,
	setActiveSpanErrorStatus,
	startActiveSpan,
} from '@zeepkist/telemetry'
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../client'
import { GHOST_FOLDER } from '../config'
import { deleteFile, uploadFile } from '../s3'
import {
	personalBestGlobal,
	record,
	recordMedia,
	recordStatistic,
	user,
	worldRecordGlobal,
} from '../schema'
import { generateUid } from '../utils/generateUid'
import type { RecordStatisticInput } from './recordStatistic'
import { buildRecordStatisticValues } from './recordStatistic'
import { recordTrackTournamentResults } from './trackTournament'

type RecordInput = typeof record.$inferInsert
const ghostUploadSuccesses = createCounter('record.ghost_upload.success', 'zeepcentraal-database')
const ghostUploadFailures = createCounter('record.ghost_upload.failure', 'zeepcentraal-database')

async function traceRecordPhase<T>(name: string, task: () => Promise<T>): Promise<T> {
	return startActiveSpan(name, async (span) => {
		try {
			return await task()
		} catch (error) {
			span.recordException(error)
			span.setErrorStatus(error instanceof Error ? error.message : String(error))
			throw error
		} finally {
			span.end()
		}
	})
}

function recordGhostUploadError(
	error: unknown,
	attributes: Record<string, string | number | boolean>,
): void {
	recordSpanError(error, attributes)
}

export async function submitRecord(
	input: RecordInput,
	statistic?: Omit<RecordStatisticInput, 'idRecord'>,
) {
	return traceRecordPhase('record.submit.transaction', () =>
		db.transaction(async (tx) => {
			const [clock] = await traceRecordPhase('record.submit.lock_wait', () =>
				tx.execute<{ accepted_at: string }>(sql`
					WITH user_lock AS MATERIALIZED (
						SELECT pg_advisory_xact_lock(${input.idUser}, ${input.idLevel})
					), level_lock AS MATERIALIZED (
						SELECT pg_advisory_xact_lock_shared(0, ${input.idLevel})
						FROM user_lock
					)
					SELECT clock_timestamp()::text AS accepted_at
					FROM level_lock
				`),
			)

			const [created] = await traceRecordPhase('record.submit.insert_and_projection', () =>
				tx.insert(record).values(input).returning(),
			)
			if (!created) {
				return null
			}
			if (!clock) throw new Error('Failed to capture record acceptance time')

			if (statistic) {
				await traceRecordPhase('record.submit.statistics', () =>
					tx
						.insert(recordStatistic)
						.values(buildRecordStatisticValues(created.id, statistic)),
				)
			}

			const now = new Date().toISOString()
			const personalBestRows = await traceRecordPhase('record.submit.personal_best', () =>
				tx
					.insert(personalBestGlobal)
					.values({
						idUser: input.idUser,
						idLevel: input.idLevel,
						idRecord: created.id,
						dateCreated: now,
						dateUpdated: now,
					})
					.onConflictDoUpdate({
						target: [personalBestGlobal.idUser, personalBestGlobal.idLevel],
						set: { idRecord: created.id, dateUpdated: now },
						where: sql`(
							SELECT current_record.time
							FROM ${record} AS current_record
							WHERE current_record.id = ${personalBestGlobal.idRecord}
						) > ${created.time}`,
					})
					.returning({ id: personalBestGlobal.id }),
			)
			const personalBestChanged = personalBestRows.length > 0

			await traceRecordPhase('record.submit.world_record', () =>
				tx
					.insert(worldRecordGlobal)
					.values({
						idUser: input.idUser,
						idLevel: input.idLevel,
						idRecord: created.id,
						dateCreated: now,
						dateUpdated: now,
					})
					.onConflictDoUpdate({
						target: worldRecordGlobal.idLevel,
						set: {
							idUser: input.idUser,
							idRecord: created.id,
							dateUpdated: now,
						},
						where: sql`(
							SELECT current_record.time
							FROM ${record} AS current_record
							WHERE current_record.id = ${worldRecordGlobal.idRecord}
						) > ${created.time}`,
					})
					.returning({ id: worldRecordGlobal.id }),
			)

			const tournamentResultChanged = await traceRecordPhase('record.submit.tournament', () =>
				recordTrackTournamentResults(tx, {
					acceptedAt: clock.accepted_at,
					idLevel: created.idLevel,
					idRecord: created.id,
					idUser: created.idUser,
					time: created.time,
				}),
			)

			return { record: created, personalBestChanged, tournamentResultChanged }
		}),
	)
}

export async function uploadRecordMedia(idRecord: number, ghostData: Uint8Array): Promise<void> {
	const ghostUrl = `${GHOST_FOLDER}/${generateUid()}.bin`
	try {
		await uploadFile(ghostUrl, ghostData)
		await db.insert(recordMedia).values({
			idRecord,
			ghostUrl,
			dateCreated: new Date().toISOString(),
			dateUpdated: new Date().toISOString(),
		})
		ghostUploadSuccesses.add(1)
	} catch (error) {
		await deleteFile(ghostUrl).catch((deleteError) => {
			console.error('[ghost] Failed cleanup after media upload failure:', deleteError)
		})
		setActiveSpanErrorStatus(
			error instanceof Error ? error.message : 'Ghost media upload failed',
		)
		recordGhostUploadError(error, {
			'record.id': idRecord,
			'record.ghost_upload.failed': true,
			'record.ghost_upload.max_attempts': 5,
		})
		ghostUploadFailures.add(1)
		console.error(`[ghost] Upload failed for record ${idRecord}:`, error)
		throw error
	}
}

export async function getPersonalBestsWithRecord({
	idLevel,
	limit = 10,
}: {
	idLevel: number
	limit?: number
}) {
	return db
		.select({
			id: record.idLevel,
			time: record.time,
			totalCount: sql<number>`COUNT(*) OVER ()`,
		})
		.from(record)
		.innerJoin(personalBestGlobal, eq(personalBestGlobal.idRecord, record.id))
		.where(eq(record.idLevel, idLevel))
		.orderBy(record.time)
		.limit(limit)
}

export async function getPersonalBestsWithRecordByLevelIds({
	idLevels,
	limit = 10,
}: {
	idLevels: number[]
	limit?: number
}) {
	if (idLevels.length === 0) {
		return []
	}

	return buildPersonalBestsWithRecordByLevelIdsQuery({ idLevels, limit })
}

export async function getV2ScorePersonalBestsByLevelIds({
	idLevels,
	limit = 20,
}: {
	idLevels: number[]
	limit?: number
}) {
	if (idLevels.length === 0) return []
	return buildV2ScorePersonalBestsByLevelIdsQuery({ idLevels, limit })
}

export function buildV2ScorePersonalBestsByLevelIdsQuery({
	idLevels,
	limit = 20,
}: {
	idLevels: number[]
	limit?: number
}) {
	const ranked = db
		.select({
			idRecord: record.id,
			idLevel: record.idLevel,
			time: record.time,
			splits: record.splits,
			totalCount: sql<number>`COUNT(*) OVER (PARTITION BY ${record.idLevel})`.as(
				'total_count',
			),
			rowNumber:
				sql<number>`ROW_NUMBER() OVER (PARTITION BY ${record.idLevel} ORDER BY ${record.time}, ${record.id})`.as(
					'row_number',
				),
		})
		.from(record)
		.innerJoin(personalBestGlobal, eq(personalBestGlobal.idRecord, record.id))
		.innerJoin(user, eq(user.id, record.idUser))
		.where(and(inArray(record.idLevel, idLevels), eq(user.banned, false)))
		.as('ranked_v2_score_personal_bests')

	return db
		.select({
			idLevel: ranked.idLevel,
			time: ranked.time,
			splits: ranked.splits,
			totalCount: ranked.totalCount,
			statisticTime: recordStatistic.time,
			turnLeftCount: recordStatistic.turnLeftCount,
			turnLeftTime: recordStatistic.turnLeftTime,
			turnRightCount: recordStatistic.turnRightCount,
			turnRightTime: recordStatistic.turnRightTime,
			brakeCount: recordStatistic.brakeCount,
			brakeTime: recordStatistic.brakeTime,
			armsUpCount: recordStatistic.armsUpCount,
			armsUpTime: recordStatistic.armsUpTime,
			driverInputTransitionCount: recordStatistic.driverInputTransitionCount,
			hasInputData: recordStatistic.hasInputData,
		})
		.from(ranked)
		.leftJoin(recordStatistic, eq(recordStatistic.idRecord, ranked.idRecord))
		.where(lte(ranked.rowNumber, limit))
		.orderBy(asc(ranked.idLevel), asc(ranked.rowNumber))
}

export function buildPersonalBestsWithRecordByLevelIdsQuery({
	idLevels,
	limit = 10,
}: {
	idLevels: number[]
	limit?: number
}) {
	const ranked = db
		.select({
			idRecord: record.id,
			idUser: record.idUser,
			idLevel: record.idLevel,
			time: record.time,
			dateCreated: record.dateCreated,
			splits: record.splits,
			speeds: record.speeds,
			statisticTime: sql<number | null>`${recordStatistic.time}`
				.mapWith(recordStatistic.time)
				.as('statistic_time'),
			distance: recordStatistic.distance,
			averageSpeed: recordStatistic.averageSpeed,
			maxSpeed: recordStatistic.maxSpeed,
			timeInAir: recordStatistic.timeInAir,
			timeOnGround: recordStatistic.timeOnGround,
			timeSlipping: recordStatistic.timeSlipping,
			timeRagdoll: recordStatistic.timeRagdoll,
			averageAngularVelocity: recordStatistic.averageAngularVelocity,
			averageGforce: recordStatistic.averageGforce,
			timeOnTarmac: recordStatistic.timeOnTarmac,
			timeOnGrass: recordStatistic.timeOnGrass,
			timeOnSand: recordStatistic.timeOnSand,
			timeOnIce1: recordStatistic.timeOnIce1,
			timeOnIce2: recordStatistic.timeOnIce2,
			timeOnIce3: recordStatistic.timeOnIce3,
			timeOnSoap: recordStatistic.timeOnSoap,
			timeOnWood: recordStatistic.timeOnWood,
			timeOnMud: recordStatistic.timeOnMud,
			turnLeftCount: recordStatistic.turnLeftCount,
			turnLeftTime: recordStatistic.turnLeftTime,
			turnRightCount: recordStatistic.turnRightCount,
			turnRightTime: recordStatistic.turnRightTime,
			brakeCount: recordStatistic.brakeCount,
			brakeTime: recordStatistic.brakeTime,
			armsUpCount: recordStatistic.armsUpCount,
			armsUpTime: recordStatistic.armsUpTime,
			driverInputTransitionCount: recordStatistic.driverInputTransitionCount,
			timeAnyDriverInput: recordStatistic.timeAnyDriverInput,
			hasInputData: recordStatistic.hasInputData,
			hasAirData: recordStatistic.hasAirData,
			hasWheelData: recordStatistic.hasWheelData,
			hasSlipData: recordStatistic.hasSlipData,
			hasStateData: recordStatistic.hasStateData,
			hasSurfaceData: recordStatistic.hasSurfaceData,
			hasVelocityData: recordStatistic.hasVelocityData,
			hasRagdollData: recordStatistic.hasRagdollData,
			totalCount: sql<number>`COUNT(*) OVER (PARTITION BY ${record.idLevel})`.as(
				'total_count',
			),
			rowNumber:
				sql<number>`ROW_NUMBER() OVER (PARTITION BY ${record.idLevel} ORDER BY ${record.time}, ${record.id})`.as(
					'row_number',
				),
		})
		.from(record)
		.innerJoin(personalBestGlobal, eq(personalBestGlobal.idRecord, record.id))
		.innerJoin(user, eq(user.id, record.idUser))
		.leftJoin(recordStatistic, eq(recordStatistic.idRecord, record.id))
		.where(and(inArray(record.idLevel, idLevels), eq(user.banned, false)))
		.as('ranked_personal_bests')

	return db
		.select({
			idRecord: ranked.idRecord,
			idUser: ranked.idUser,
			idLevel: ranked.idLevel,
			time: ranked.time,
			dateCreated: ranked.dateCreated,
			splits: ranked.splits,
			speeds: ranked.speeds,
			statisticTime: ranked.statisticTime,
			distance: ranked.distance,
			averageSpeed: ranked.averageSpeed,
			maxSpeed: ranked.maxSpeed,
			timeInAir: ranked.timeInAir,
			timeOnGround: ranked.timeOnGround,
			timeSlipping: ranked.timeSlipping,
			timeRagdoll: ranked.timeRagdoll,
			averageAngularVelocity: ranked.averageAngularVelocity,
			averageGforce: ranked.averageGforce,
			timeOnTarmac: ranked.timeOnTarmac,
			timeOnGrass: ranked.timeOnGrass,
			timeOnSand: ranked.timeOnSand,
			timeOnIce1: ranked.timeOnIce1,
			timeOnIce2: ranked.timeOnIce2,
			timeOnIce3: ranked.timeOnIce3,
			timeOnSoap: ranked.timeOnSoap,
			timeOnWood: ranked.timeOnWood,
			timeOnMud: ranked.timeOnMud,
			turnLeftCount: ranked.turnLeftCount,
			turnLeftTime: ranked.turnLeftTime,
			turnRightCount: ranked.turnRightCount,
			turnRightTime: ranked.turnRightTime,
			brakeCount: ranked.brakeCount,
			brakeTime: ranked.brakeTime,
			armsUpCount: ranked.armsUpCount,
			armsUpTime: ranked.armsUpTime,
			driverInputTransitionCount: ranked.driverInputTransitionCount,
			timeAnyDriverInput: ranked.timeAnyDriverInput,
			hasInputData: ranked.hasInputData,
			hasAirData: ranked.hasAirData,
			hasWheelData: ranked.hasWheelData,
			hasSlipData: ranked.hasSlipData,
			hasStateData: ranked.hasStateData,
			hasSurfaceData: ranked.hasSurfaceData,
			hasVelocityData: ranked.hasVelocityData,
			hasRagdollData: ranked.hasRagdollData,
			totalCount: ranked.totalCount,
		})
		.from(ranked)
		.where(lte(ranked.rowNumber, limit))
		.orderBy(asc(ranked.idLevel), asc(ranked.rowNumber))
}
