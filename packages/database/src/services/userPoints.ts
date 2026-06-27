import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { userPoints } from '../schema'

interface UserPointsInput {
	idUser: number
	points: number
	totalPoints: number
}

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
}: UserPointsInput): Promise<void> {
	await db.transaction(async (tx) => {
		const dateUpdated = new Date().toISOString()
		const [updated] = await tx
			.update(userPoints)
			.set({
				points,
				totalPoints,
				dateUpdated,
			})
			.where(eq(userPoints.idUser, idUser))
			.returning({ idUser: userPoints.idUser })
		if (updated) {
			return
		}

		await tx
			.insert(userPoints)
			.values({
				idUser,
				points,
				totalPoints,
				dateUpdated,
			})
			.onConflictDoUpdate({
				target: [userPoints.idUser],
				set: {
					points,
					totalPoints,
					dateUpdated,
				},
			})
	})
}

function dedupeUserPointsEntries(entries: UserPointsInput[]): UserPointsInput[] {
	return [...new Map(entries.map((entry) => [entry.idUser, entry])).values()]
}

export function buildUpdateUserPointsBulkSql(entries: UserPointsInput[], dateUpdated: string) {
	const values = sql.join(
		entries.map(
			(entry) =>
				sql`(${entry.idUser}::integer, ${entry.points}::integer, ${entry.totalPoints}::integer)`,
		),
		sql`, `,
	)
	return sql<{ idUser: number }>`
		UPDATE ${userPoints} AS target
		SET
			points = source.points,
			total_points = source.total_points,
			date_updated = ${dateUpdated}
		FROM (VALUES ${values}) AS source(id_user, points, total_points)
		WHERE target.id_user = source.id_user
		RETURNING target.id_user AS "idUser"
	`
}

export async function upsertUserPointsBulk(entries: UserPointsInput[]) {
	if (entries.length === 0) {
		return
	}
	const dedupedEntries = dedupeUserPointsEntries(entries)
	const dateUpdated = new Date().toISOString()

	await db.transaction(async (tx) => {
		const updatedRows = await tx.execute(
			buildUpdateUserPointsBulkSql(dedupedEntries, dateUpdated),
		)
		const updatedUserIds = new Set(updatedRows.map((row) => row.idUser))
		const missingEntries = dedupedEntries.filter((entry) => !updatedUserIds.has(entry.idUser))
		if (missingEntries.length === 0) {
			return
		}

		await tx
			.insert(userPoints)
			.values(missingEntries.map((entry) => ({ ...entry, dateUpdated })))
			.onConflictDoUpdate({
				target: [userPoints.idUser],
				set: {
					points: sql`EXCLUDED.points`,
					totalPoints: sql`EXCLUDED.total_points`,
					dateUpdated,
				},
			})
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
