import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../index'
import { userPoints } from '../schema'

export async function getTotalUserPoints() {
	const totalPoints = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(userPoints)
		.then((rows) => Number(rows[0]?.count))

	return totalPoints ?? 0
}

export async function getUserPointsPaginated(offset: number, limit: number) {
	return db
		.select({
			idUser: userPoints.idUser,
			points: userPoints.points,
			totalPoints: userPoints.totalPoints,
			rank: userPoints.rank,
			worldRecords: userPoints.worldRecords,
		})
		.from(userPoints)
		.limit(limit)
		.offset(offset)
}

export async function upsertUserPoints({
	idUser,
	points,
	totalPoints,
}: {
	idUser: number
	points: number
	totalPoints: number
}): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(userPoints)
			.values({
				idUser,
				points,
				totalPoints,
				dateUpdated: new Date().toISOString(),
			})
			.onConflictDoUpdate({
				target: [userPoints.idUser],
				set: {
					points,
					totalPoints,
					dateUpdated: new Date().toISOString(),
				},
			})
	})
}

export async function updateUserRank({
	idUser,
	rank,
}: {
	idUser: number
	rank: number
}): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.update(userPoints)
			.set({
				rank,
				dateUpdated: new Date().toISOString(),
			})
			.where(eq(userPoints.idUser, idUser))
	})
}

export async function bulkUpdateUserRanks({
	idUsers,
	points,
	rank,
}: {
	idUsers: number[]
	points: number
	rank: number
}): Promise<void> {
	if (idUsers.length === 0) {
		return
	}

	await db.transaction(async (tx) => {
		await tx
			.update(userPoints)
			.set({
				points,
				rank,
				dateUpdated: new Date().toISOString(),
			})
			.where(inArray(userPoints.idUser, idUsers))
	})
}
