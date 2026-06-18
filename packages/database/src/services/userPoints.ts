import { inArray, sql } from 'drizzle-orm'
import { db } from '../client'
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

export async function getAllUserPointIds(): Promise<number[]> {
	const rows = await db
		.select({ idUser: userPoints.idUser })
		.from(userPoints)
		.orderBy(userPoints.idUser)
	return rows.map((row) => row.idUser)
}

export async function getUserPointsByIds(ids: number[]) {
	if (ids.length === 0) {
		return []
	}
	return db
		.select({
			idUser: userPoints.idUser,
			points: userPoints.points,
			totalPoints: userPoints.totalPoints,
			rank: userPoints.rank,
			worldRecords: userPoints.worldRecords,
		})
		.from(userPoints)
		.where(inArray(userPoints.idUser, ids))
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

export async function upsertUserPointsBulk(
	entries: Array<{ idUser: number; points: number; totalPoints: number }>,
) {
	if (entries.length === 0) {
		return
	}
	const dateUpdated = new Date().toISOString()
	await db
		.insert(userPoints)
		.values(entries.map((entry) => ({ ...entry, dateUpdated })))
		.onConflictDoUpdate({
			target: [userPoints.idUser],
			set: {
				points: sql`EXCLUDED.points`,
				totalPoints: sql`EXCLUDED.total_points`,
				dateUpdated,
			},
		})
}

export async function updateUserRanks(entries: Array<{ idUser: number; rank: number }>) {
	if (entries.length === 0) {
		return
	}
	const values = sql.join(
		entries.map((entry) => sql`(${entry.idUser}::integer, ${entry.rank}::integer)`),
		sql`, `,
	)
	await db.execute(sql`
		UPDATE ${userPoints} AS target
		SET rank = source.rank, date_updated = NOW()
		FROM (VALUES ${values}) AS source(id_user, rank)
		WHERE target.id_user = source.id_user
	`)
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
