import { eq } from 'drizzle-orm'
import { db } from '../client'
import { managedLobby } from '../schema'

export async function getManagedLobbyJoinId(key: string) {
	const [row] = await db
		.select({ joinId: managedLobby.joinId })
		.from(managedLobby)
		.where(eq(managedLobby.key, key))
		.limit(1)
	return row?.joinId
}

export async function setManagedLobbyJoinId(key: string, joinId: string) {
	const now = new Date().toISOString()
	await db
		.insert(managedLobby)
		.values({ key, joinId, dateCreated: now, dateUpdated: now })
		.onConflictDoUpdate({
			target: managedLobby.key,
			set: { joinId, dateUpdated: now },
		})
}

export async function clearManagedLobbyJoinId(key: string) {
	await db.delete(managedLobby).where(eq(managedLobby.key, key))
}
