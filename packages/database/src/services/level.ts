import { and, asc, eq, gt, gte, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { level, levelItem, record, workshopItem } from '../schema'
import { resolveAdventureStatus } from './levelHelpers'

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
		const updateExistingLevel = async (
			existing: typeof level.$inferSelect,
			nextXxHash?: string,
		): Promise<typeof level.$inferSelect> => {
			const nextAdventure = resolveAdventureStatus(existing.adventure, adventure)
			if (nextXxHash === undefined && nextAdventure === existing.adventure) {
				return existing
			}

			// Workshop writes lock workshop_item before updating level. Match that order here so an
			// Adventure promotion cannot deadlock with a concurrent Workshop refresh. Sorting makes
			// aliases spanning multiple Workshop items deterministic.
			await tx.execute(sql`
				SELECT ${workshopItem.workshopId}
				FROM ${workshopItem}
				WHERE EXISTS (
					SELECT 1
					FROM ${levelItem}
					WHERE ${levelItem.idLevel} = ${existing.id}
						AND ${levelItem.workshopId} = ${workshopItem.workshopId}
				)
				ORDER BY ${workshopItem.workshopId}
				FOR UPDATE
			`)

			const [updated] = await tx
				.update(level)
				.set({
					...(nextXxHash === undefined ? {} : { xxHash: nextXxHash }),
					adventure: nextAdventure,
					dateUpdated: new Date().toISOString(),
				})
				.where(eq(level.id, existing.id))
				.returning()
			return updated ?? existing
		}

		const existingByXxHash = await tx.query.level.findFirst({
			where: eq(level.xxHash, xxHash),
		})
		if (existingByXxHash) {
			return updateExistingLevel(existingByXxHash)
		}

		const existingByLegacyHash = await tx.query.level.findFirst({
			where: eq(level.hash, hash),
			orderBy: (level, { asc }) => [asc(level.id)],
		})
		if (existingByLegacyHash && !existingByLegacyHash.xxHash) {
			return updateExistingLevel(existingByLegacyHash, xxHash)
		}

		const [created] = await tx
			.insert(level)
			.values({ hash, xxHash, adventure })
			.onConflictDoNothing({ target: level.xxHash })
			.returning()
		if (created) {
			return created
		}

		const concurrent = await tx.query.level.findFirst({
			where: eq(level.xxHash, xxHash),
		})
		if (concurrent) {
			return updateExistingLevel(concurrent)
		}
		throw new Error(`Unable to resolve level for xxHash ${xxHash}`)
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

export async function getLevelIdsPage({
	afterId = 0,
	limit,
	recordsSince,
}: {
	afterId?: number
	limit: number
	recordsSince?: Date
}): Promise<number[]> {
	const rows = await db
		.select({ id: level.id })
		.from(level)
		.where(
			and(
				gt(level.id, afterId),
				recordsSince
					? sql`EXISTS (
						SELECT 1 FROM ${record}
						WHERE ${record.idLevel} = ${level.id}
							AND ${record.dateCreated} >= ${recordsSince.toISOString()}
					)`
					: undefined,
			),
		)
		.orderBy(asc(level.id))
		.limit(limit)
	return rows.map((row) => row.id)
}
