import { metrics } from '@opentelemetry/api'
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../client'
import { GHOST_FOLDER } from '../config'
import { deleteFile, uploadFile } from '../s3'
import { personalBestGlobal, record, recordMedia, worldRecordGlobal } from '../schema'
import { generateUid } from '../utils/generateUid'

type RecordInput = typeof record.$inferInsert
const meter = metrics.getMeter('@zeepkist/database')
const ghostUploadSuccesses = meter.createCounter('record.ghost_upload.success')
const ghostUploadFailures = meter.createCounter('record.ghost_upload.failure')

export async function submitRecord(input: RecordInput) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.idUser}, ${input.idLevel})`)
		await tx.execute(sql`SELECT pg_advisory_xact_lock(0, ${input.idLevel})`)

		const [created] = await tx.insert(record).values(input).returning()
		if (!created) {
			return null
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
		await uploadFile(ghostUrl, Buffer.from(ghostData, 'base64'))
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

	const ranked = db
		.select({
			idLevel: record.idLevel,
			time: record.time,
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
		.where(inArray(record.idLevel, idLevels))
		.as('ranked_personal_bests')

	return db
		.select({
			idLevel: ranked.idLevel,
			time: ranked.time,
			totalCount: ranked.totalCount,
		})
		.from(ranked)
		.where(lte(ranked.rowNumber, limit))
		.orderBy(asc(ranked.idLevel), asc(ranked.rowNumber))
}
