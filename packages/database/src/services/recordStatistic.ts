import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../client'
import { recordMedia, recordStatistic } from '../schema'

export type RecordStatisticInput = Omit<
	typeof recordStatistic.$inferInsert,
	'dateCreated' | 'dateUpdated'
>

export function buildRecordStatisticValues(
	idRecord: number,
	input: Omit<RecordStatisticInput, 'idRecord'>,
): typeof recordStatistic.$inferInsert {
	const now = new Date().toISOString()
	return {
		...input,
		idRecord,
		dateCreated: now,
		dateUpdated: now,
	}
}

export async function upsertRecordStatistic(input: RecordStatisticInput): Promise<void> {
	const now = new Date().toISOString()
	await db
		.insert(recordStatistic)
		.values({
			...input,
			dateCreated: now,
			dateUpdated: now,
		})
		.onConflictDoUpdate({
			target: recordStatistic.idRecord,
			set: {
				frameCount: input.frameCount,
				duration: input.duration,
				distanceTravelled: input.distanceTravelled,
				distanceInAir: input.distanceInAir,
				distanceOnGround: input.distanceOnGround,
				timeInAir: input.timeInAir,
				timeOnGround: input.timeOnGround,
				averageSpeed: input.averageSpeed,
				topSpeed: input.topSpeed,
				armsUpCount: input.armsUpCount,
				armsUpTime: input.armsUpTime,
				brakeCount: input.brakeCount,
				brakeTime: input.brakeTime,
				turnLeftCount: input.turnLeftCount,
				turnLeftTime: input.turnLeftTime,
				turnRightCount: input.turnRightCount,
				turnRightTime: input.turnRightTime,
				hornCount: input.hornCount,
				hornTime: input.hornTime,
				soapTime: input.soapTime,
				offroadTime: input.offroadTime,
				paragliderTime: input.paragliderTime,
				distanceOnTarmac: input.distanceOnTarmac,
				distanceOnGrass: input.distanceOnGrass,
				distanceOnSand: input.distanceOnSand,
				distanceOnSnow: input.distanceOnSnow,
				distanceOnIce: input.distanceOnIce,
				distanceOnSoap: input.distanceOnSoap,
				distanceOnMetal: input.distanceOnMetal,
				timeOnTarmac: input.timeOnTarmac,
				timeOnGrass: input.timeOnGrass,
				timeOnSand: input.timeOnSand,
				timeOnSnow: input.timeOnSnow,
				timeOnIce: input.timeOnIce,
				timeOnSoap: input.timeOnSoap,
				timeOnMetal: input.timeOnMetal,
				dateUpdated: now,
			},
		})
}

export async function getRecordMediaForStatisticBackfill({
	offset = 0,
	limit,
	ids,
}: {
	offset?: number
	limit: number
	ids?: number[]
}) {
	const conditions = [sql`${recordMedia.ghostUrl} IS NOT NULL`]
	if (ids && ids.length > 0) {
		conditions.push(inArray(recordMedia.idRecord, ids))
	} else {
		conditions.push(isNull(recordStatistic.idRecord))
	}

	return db
		.select({
			idRecord: recordMedia.idRecord,
			ghostUrl: recordMedia.ghostUrl,
		})
		.from(recordMedia)
		.leftJoin(recordStatistic, eq(recordStatistic.idRecord, recordMedia.idRecord))
		.where(and(...conditions))
		.orderBy(asc(recordMedia.idRecord))
		.offset(offset)
		.limit(limit)
}
