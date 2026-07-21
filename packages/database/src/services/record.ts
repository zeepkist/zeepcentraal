import { createCounter, recordSpanError, setActiveSpanErrorStatus } from '@zeepkist/telemetry'
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

type RecordInput = typeof record.$inferInsert
const ghostUploadSuccesses = createCounter('record.ghost_upload.success', 'zeepcentraal-database')
const ghostUploadFailures = createCounter('record.ghost_upload.failure', 'zeepcentraal-database')
const GHOST_UPLOAD_MAX_ATTEMPTS = 5
const GHOST_UPLOAD_RETRY_DELAY_MS = 1_000

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function recordGhostUploadError(
	error: unknown,
	attributes: Record<string, string | number | boolean>,
): void {
	recordSpanError(error, attributes)
}

async function uploadGhostFileWithRetry(ghostUrl: string, file: Buffer): Promise<void> {
	let lastError: unknown

	for (let attempt = 1; attempt <= GHOST_UPLOAD_MAX_ATTEMPTS; attempt++) {
		try {
			await uploadFile(ghostUrl, file)
			return
		} catch (error) {
			lastError = error
			recordGhostUploadError(error, {
				'record.ghost_upload.attempt': attempt,
				'record.ghost_upload.max_attempts': GHOST_UPLOAD_MAX_ATTEMPTS,
				'record.ghost_upload.retrying': attempt < GHOST_UPLOAD_MAX_ATTEMPTS,
			})

			console.error(
				`[ghost] Upload attempt ${attempt}/${GHOST_UPLOAD_MAX_ATTEMPTS} failed for ${ghostUrl}:`,
				error,
			)

			if (attempt === GHOST_UPLOAD_MAX_ATTEMPTS) {
				break
			}

			await wait(GHOST_UPLOAD_RETRY_DELAY_MS)
		}
	}

	throw lastError
}

export async function submitRecord(
	input: RecordInput,
	statistic?: Omit<RecordStatisticInput, 'idRecord'>,
) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.idUser}, ${input.idLevel})`)
		await tx.execute(sql`SELECT pg_advisory_xact_lock(0, ${input.idLevel})`)

		const [created] = await tx.insert(record).values(input).returning()
		if (!created) {
			return null
		}

		if (statistic) {
			await tx
				.insert(recordStatistic)
				.values(buildRecordStatisticValues(created.id, statistic))
		}

		const existingPersonalBest = await tx
			.select({ id: personalBestGlobal.id, time: record.time })
			.from(personalBestGlobal)
			.innerJoin(record, eq(record.id, personalBestGlobal.idRecord))
			.where(
				and(
					eq(personalBestGlobal.idUser, input.idUser),
					eq(personalBestGlobal.idLevel, input.idLevel),
				),
			)
			.limit(1)
			.then((rows) => rows[0])

		const personalBestChanged =
			!existingPersonalBest || existingPersonalBest.time > created.time
		if (personalBestChanged) {
			const now = new Date().toISOString()
			await tx
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
				})
		}

		const existingWorldRecord = await tx
			.select({ id: worldRecordGlobal.id, time: record.time })
			.from(worldRecordGlobal)
			.innerJoin(record, eq(record.id, worldRecordGlobal.idRecord))
			.where(eq(worldRecordGlobal.idLevel, input.idLevel))
			.limit(1)
			.then((rows) => rows[0])

		if (!existingWorldRecord || existingWorldRecord.time > created.time) {
			const now = new Date().toISOString()
			await tx
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
				})
		}

		return { record: created, personalBestChanged }
	})
}

export function scheduleRecordMediaUpload(idRecord: number, ghostData: string): void {
	const ghostUrl = `${GHOST_FOLDER}/${generateUid()}.bin`
	void (async () => {
		await uploadGhostFileWithRetry(ghostUrl, Buffer.from(ghostData, 'base64'))
		try {
			await db.insert(recordMedia).values({
				idRecord,
				ghostUrl,
				dateCreated: new Date().toISOString(),
				dateUpdated: new Date().toISOString(),
			})
			ghostUploadSuccesses.add(1)
		} catch (error) {
			await deleteFile(ghostUrl).catch((deleteError) => {
				console.error('[ghost] Failed cleanup after media insert failure:', deleteError)
			})
			throw error
		}
	})().catch((error) => {
		setActiveSpanErrorStatus(
			error instanceof Error ? error.message : 'Ghost media upload failed',
		)
		recordGhostUploadError(error, {
			'record.id': idRecord,
			'record.ghost_upload.failed': true,
			'record.ghost_upload.max_attempts': GHOST_UPLOAD_MAX_ATTEMPTS,
		})
		ghostUploadFailures.add(1)
		console.error(`[ghost] Upload failed for record ${idRecord}:`, error)
	})
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
	limit = 50,
}: {
	idLevels: number[]
	limit?: number
}) {
	if (idLevels.length === 0) return []
	return buildV2ScorePersonalBestsByLevelIdsQuery({ idLevels, limit })
}

export function buildV2ScorePersonalBestsByLevelIdsQuery({
	idLevels,
	limit = 50,
}: {
	idLevels: number[]
	limit?: number
}) {
	const ranked = db
		.select({
			idRecord: record.id,
			idLevel: record.idLevel,
			time: record.time,
			dateCreated: record.dateCreated,
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
			dateCreated: ranked.dateCreated,
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
			timeOnSnow: recordStatistic.timeOnSnow,
			timeOnIce: recordStatistic.timeOnIce,
			timeOnSoap: recordStatistic.timeOnSoap,
			timeOnMetal: recordStatistic.timeOnMetal,
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
			timeOnSnow: ranked.timeOnSnow,
			timeOnIce: ranked.timeOnIce,
			timeOnSoap: ranked.timeOnSoap,
			timeOnMetal: ranked.timeOnMetal,
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
