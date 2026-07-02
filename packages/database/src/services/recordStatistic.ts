import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
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
				time: input.time,
				distance: input.distance,
				distanceInAir: input.distanceInAir,
				distanceOnGround: input.distanceOnGround,
				distanceOn1Wheel: input.distanceOn1Wheel,
				distanceOn2Wheels: input.distanceOn2Wheels,
				distanceOn3Wheels: input.distanceOn3Wheels,
				distanceOn4Wheels: input.distanceOn4Wheels,
				timeInAir: input.timeInAir,
				timeOnGround: input.timeOnGround,
				timeOn1Wheel: input.timeOn1Wheel,
				timeOn2Wheels: input.timeOn2Wheels,
				timeOn3Wheels: input.timeOn3Wheels,
				timeOn4Wheels: input.timeOn4Wheels,
				averageSpeed: input.averageSpeed,
				maxSpeed: input.maxSpeed,
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
				distanceSlipping: input.distanceSlipping,
				distanceParaglider: input.distanceParaglider,
				distanceOffroadWheels: input.distanceOffroadWheels,
				distanceSoapWheels: input.distanceSoapWheels,
				distanceOnMonorail: input.distanceOnMonorail,
				distanceParked: input.distanceParked,
				timeSlipping: input.timeSlipping,
				timeParaglider: input.timeParaglider,
				timeOffroadWheels: input.timeOffroadWheels,
				timeSoapWheels: input.timeSoapWheels,
				timeOnMonorail: input.timeOnMonorail,
				timeParked: input.timeParked,
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
				averageVelocity: input.averageVelocity,
				maxVelocity: input.maxVelocity,
				averageAngularVelocity: input.averageAngularVelocity,
				maxAngularVelocity: input.maxAngularVelocity,
				averageGforce: input.averageGforce,
				maxGforce: input.maxGforce,
				dateUpdated: now,
			},
		})
}

export async function getRecordMediaForStatisticBackfill({
	limit,
	ids,
	afterId,
}: {
	limit: number
	ids?: number[]
	afterId?: number
}) {
	const conditions = [sql`${recordMedia.ghostUrl} IS NOT NULL`]
	if (ids && ids.length > 0) {
		conditions.push(inArray(recordMedia.idRecord, ids))
	} else {
		conditions.push(isNull(recordStatistic.idRecord))
		if (afterId !== undefined) {
			conditions.push(gt(recordMedia.idRecord, afterId))
		}
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
		.limit(limit)
}
