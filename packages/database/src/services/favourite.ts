import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { favourite } from '../schema'

export async function addFavourite(userId: number, levelId: number): Promise<void> {
	await db
		.insert(favourite)
		.values({ idUser: userId, idLevel: levelId })
		.onConflictDoNothing({ target: [favourite.idUser, favourite.idLevel] })
}

export async function removeFavourite(userId: number, levelId: number): Promise<void> {
	await db
		.delete(favourite)
		.where(and(eq(favourite.idUser, userId), eq(favourite.idLevel, levelId)))
}
