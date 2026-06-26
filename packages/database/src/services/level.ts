import { eq, gte, inArray } from 'drizzle-orm'
import { db } from '../client'
import { level, levelItem, record } from '../schema'

export async function getLevel(hash: string) {
	return db.query.level.findFirst({
		where: eq(level.hash, hash),
	})
}

export async function getLevelByXxHash(xxHash: string) {
	return db.query.level.findFirst({
		where: eq(level.xxHash, xxHash),
	})
}

export async function getOrInsertLevel(hash: string) {
	const existing = await getLevel(hash)
	if (existing) {
		return existing
	}

	const [created] = await db.insert(level).values({ hash }).returning()
	return created ?? getLevel(hash)
}

export async function getOrInsertLevelWithAdventure(hash: string, adventure: boolean) {
	const resolved = await getOrInsertLevel(hash)
	if (!resolved || resolved.adventure === adventure) {
		return resolved
	}
	const [updated] = await db
		.update(level)
		.set({ adventure, dateUpdated: new Date().toISOString() })
		.where(eq(level.id, resolved.id))
		.returning()
	return updated ?? resolved
}

export async function getOrInsertLevelWithCanonicalHash({
	hash,
	xxHash,
	adventure,
}: {
	hash: string
	xxHash: string
	adventure: boolean
}) {
	return db.transaction(async (tx) => {
		const existingByXxHash = await tx.query.level.findFirst({
			where: eq(level.xxHash, xxHash),
		})
		if (existingByXxHash) {
			return existingByXxHash
		}

		const existingByLegacyHash = await tx.query.level.findFirst({
			where: eq(level.hash, hash),
			orderBy: (level, { asc }) => [asc(level.id)],
		})
		if (existingByLegacyHash && !existingByLegacyHash.xxHash) {
			const [updated] = await tx
				.update(level)
				.set({ xxHash, adventure, dateUpdated: new Date().toISOString() })
				.where(eq(level.id, existingByLegacyHash.id))
				.returning()
			return updated ?? getLevelByXxHash(xxHash)
		}

		try {
			const [created] = await tx.insert(level).values({ hash, xxHash, adventure }).returning()
			return created ?? getLevelByXxHash(xxHash)
		} catch (error) {
			const concurrent = await tx.query.level.findFirst({
				where: eq(level.xxHash, xxHash),
			})
			if (concurrent) {
				return concurrent
			}
			throw error
		}
	})
}

export async function getLevelByUuid(uuid: string): Promise<{ id: number } | null> {
	const existing = await db
		.select({ id: level.id })
		.from(level)
		.innerJoin(levelItem, eq(level.id, levelItem.idLevel))
		.where(eq(levelItem.fileUid, uuid))
		.limit(1)
		.then((rows) => rows[0] ?? null)

	return existing
}

export async function getLevelsByUuidsBulk(uuids: string[]) {
	if (uuids.length === 0) {
		return new Map<string, { id: number; uuid: string }>()
	}

	const levels = await db
		.select({
			id: level.id,
			uuid: levelItem.fileUid,
		})
		.from(level)
		.innerJoin(levelItem, eq(level.id, levelItem.idLevel))
		.where(inArray(levelItem.fileUid, uuids))

	return new Map(levels.map((entry) => [entry.uuid, entry]))
}

export async function getAllLevelIds(): Promise<number[]> {
	const levels = await db.select({ id: level.id }).from(level)
	return levels.map((entry) => entry.id)
}

export async function getAllLevelIdsWithRecordsSince(recordsSince: Date): Promise<number[]> {
	const levels = await db
		.selectDistinct({ id: level.id })
		.from(level)
		.innerJoin(record, eq(level.id, record.idLevel))
		.where(gte(record.dateCreated, recordsSince.toISOString()))

	return levels.map((entry) => entry.id)
}
