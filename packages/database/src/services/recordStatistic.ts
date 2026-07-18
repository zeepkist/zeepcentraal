import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
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
				ghostVersion: input.ghostVersion,
				hasInputData: input.hasInputData,
				hasAirData: input.hasAirData,
				hasWheelData: input.hasWheelData,
				hasSlipData: input.hasSlipData,
				hasStateData: input.hasStateData,
				hasSurfaceData: input.hasSurfaceData,
				hasVelocityData: input.hasVelocityData,
				hasRagdollData: input.hasRagdollData,
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
				distanceRagdoll: input.distanceRagdoll,
				timeSlipping: input.timeSlipping,
				timeParaglider: input.timeParaglider,
				timeOffroadWheels: input.timeOffroadWheels,
				timeSoapWheels: input.timeSoapWheels,
				timeOnMonorail: input.timeOnMonorail,
				timeParked: input.timeParked,
				timeRagdoll: input.timeRagdoll,
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
				timeAnyDriverInput: input.timeAnyDriverInput,
				driverInputTransitionCount: input.driverInputTransitionCount,
				dateUpdated: now,
			},
		})
}

export async function getRecordMediaForStatisticBackfill({
	limit,
	ids,
	beforeId,
}: {
	limit: number
	ids?: number[]
	beforeId?: number
}) {
	const conditions = [sql`${recordMedia.ghostUrl} IS NOT NULL`]
	if (ids && ids.length > 0) {
		conditions.push(inArray(recordMedia.idRecord, ids))
	} else {
		const incompleteStatistic = or(
			isNull(recordStatistic.idRecord),
			isNull(recordStatistic.ghostVersion),
			isNull(recordStatistic.hasInputData),
			isNull(recordStatistic.hasAirData),
			isNull(recordStatistic.hasWheelData),
			isNull(recordStatistic.hasSlipData),
			isNull(recordStatistic.hasStateData),
			isNull(recordStatistic.hasSurfaceData),
			isNull(recordStatistic.hasVelocityData),
			isNull(recordStatistic.hasRagdollData),
			and(
				eq(recordStatistic.hasInputData, true),
				or(
					isNull(recordStatistic.timeAnyDriverInput),
					isNull(recordStatistic.driverInputTransitionCount),
				),
			),
		)
		if (incompleteStatistic) conditions.push(incompleteStatistic)
		if (beforeId !== undefined) {
			conditions.push(lt(recordMedia.idRecord, beforeId))
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
		.orderBy(desc(recordMedia.idRecord))
		.limit(limit)
}

export async function getRecordIdsWithGhostMedia(ids: number[]): Promise<number[]> {
	if (ids.length === 0) {
		return []
	}

	const media = await getRecordMediaForStatisticBackfill({
		ids,
		limit: ids.length,
	})

	return media.map((item) => item.idRecord)
}
