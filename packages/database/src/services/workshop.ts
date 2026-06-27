import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { uploadFile } from '../s3'
import { level, levelItem, levelMetadata, levelRequest, user, workshopItem } from '../schema'
import { generateUid } from '../utils/generateUid'
import { resolveSteamNameForWorkshopAuthor } from './user'

export interface WorkshopLevelInput {
	hash: string
	xxHash: string
	workshopId: bigint
	workshopName: string
	workshopImageUrl: string
	authorId: bigint
	name: string
	imageUrl: string
	fileAuthor: string
	fileUid: string
	validationTimeAuthor: number
	validationTimeGold: number
	validationTimeSilver: number
	validationTimeBronze: number
	createdAt: string
	updatedAt: string
	format: number
	amountCheckpoints: number
	amountFinishes: number
	amountBlocks: number
	typeGround: number
	typeSkybox: number
	blocks: unknown
}

export async function uploadWorkshopThumbnail(
	extension: string,
	contents: Buffer,
): Promise<string> {
	const normalizedExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '')
	if (!normalizedExtension) {
		throw new Error('Workshop thumbnail extension is invalid')
	}
	const objectKey = `thumbnails/${generateUid()}.${normalizedExtension}`
	await uploadFile(objectKey, contents)
	return objectKey
}

export async function hasLevelMetadata(idLevel: number): Promise<boolean> {
	const row = await db
		.select({ id: levelMetadata.id })
		.from(levelMetadata)
		.where(eq(levelMetadata.idLevel, idLevel))
		.limit(1)
		.then((rows) => rows[0])
	return Boolean(row)
}

export async function claimLevelRequest({
	workshopId,
	hash,
	uid,
}: {
	workshopId: bigint
	hash?: string
	uid?: string
}): Promise<boolean> {
	const [claimed] = await db
		.insert(levelRequest)
		.values({ workshopId, hash, uid })
		.onConflictDoNothing({ target: levelRequest.workshopId })
		.returning({ id: levelRequest.id })
	return Boolean(claimed)
}

export async function releaseLevelRequest(workshopId: bigint): Promise<void> {
	await db.delete(levelRequest).where(eq(levelRequest.workshopId, workshopId))
}

export async function getPendingLevelRequestWorkshopIds(): Promise<bigint[]> {
	const rows = await db
		.select({ workshopId: levelRequest.workshopId })
		.from(levelRequest)
		.orderBy(levelRequest.id)
	return rows.map((row) => row.workshopId)
}

export async function upsertWorkshopLevel(input: WorkshopLevelInput): Promise<number> {
	const authorSteamName = await resolveSteamNameForWorkshopAuthor(input.authorId)
	return db.transaction(async (tx) => {
		const now = new Date().toISOString()
		await tx
			.insert(user)
			.values({
				steamId: input.authorId,
				steamName: authorSteamName,
				discordId: -1n,
				banned: false,
				dateCreated: now,
				dateUpdated: now,
			})
			.onConflictDoUpdate({
				target: user.steamId,
				set: {
					steamName: authorSteamName,
					dateUpdated: now,
				},
			})

		await tx
			.insert(workshopItem)
			.values({
				workshopId: input.workshopId,
				authorId: input.authorId,
				name: input.workshopName,
				imageUrl: input.workshopImageUrl,
			})
			.onConflictDoUpdate({
				target: workshopItem.workshopId,
				set: {
					authorId: input.authorId,
					name: input.workshopName,
					imageUrl: input.workshopImageUrl,
				},
			})

		const existingItem = await tx
			.select({
				id: levelItem.id,
				idLevel: levelItem.idLevel,
				deleted: levelItem.deleted,
				xxHash: level.xxHash,
			})
			.from(levelItem)
			.innerJoin(level, eq(level.id, levelItem.idLevel))
			.where(
				and(
					eq(levelItem.workshopId, input.workshopId),
					eq(levelItem.fileUid, input.fileUid),
				),
			)
			.orderBy(asc(levelItem.id))
			.limit(1)
			.then((rows) => rows[0])
		const existingItemLevel =
			existingItem && !existingItem.deleted && existingItem.xxHash === input.xxHash
				? { id: existingItem.idLevel }
				: undefined
		const existingByXxHash = !existingItemLevel
			? await tx
					.select({ id: level.id })
					.from(level)
					.where(eq(level.xxHash, input.xxHash))
					.limit(1)
					.then((rows) => rows[0])
			: undefined
		const existingByLegacyHash =
			!existingItemLevel && !existingByXxHash
				? await tx
						.select({ id: level.id, xxHash: level.xxHash })
						.from(level)
						.where(eq(level.hash, input.hash))
						.orderBy(asc(level.id))
						.then((rows) => rows.find((row) => row.xxHash === input.xxHash))
				: undefined

		let createdLevel: { id: number } | undefined
		if (!existingItemLevel && !existingByXxHash && !existingByLegacyHash) {
			try {
				;[createdLevel] = await tx
					.insert(level)
					.values({ hash: input.hash, xxHash: input.xxHash, adventure: false })
					.returning({ id: level.id })
			} catch (error) {
				createdLevel = await tx
					.select({ id: level.id })
					.from(level)
					.where(eq(level.xxHash, input.xxHash))
					.limit(1)
					.then((rows) => rows[0])
				if (!createdLevel) {
					throw error
				}
			}
		}
		const idLevel =
			existingItemLevel?.id ??
			existingByXxHash?.id ??
			existingByLegacyHash?.id ??
			createdLevel?.id
		if (!idLevel) {
			throw new Error(`Unable to resolve level for hash ${input.hash}`)
		}

		await tx
			.update(level)
			.set({
				hash: input.hash,
				xxHash: input.xxHash,
				adventure: false,
				dateUpdated: now,
			})
			.where(eq(level.id, idLevel))

		const existingMetadata = await tx
			.select({ id: levelMetadata.id })
			.from(levelMetadata)
			.where(eq(levelMetadata.idLevel, idLevel))
			.orderBy(asc(levelMetadata.id))
			.limit(1)
			.then((rows) => rows[0])
		const metadataValues = {
			amountCheckpoints: input.amountCheckpoints,
			amountFinishes: input.amountFinishes,
			amountBlocks: input.amountBlocks,
			typeGround: input.typeGround,
			typeSkybox: input.typeSkybox,
			format: input.format,
			blocks: input.blocks,
			dateUpdated: now,
		}
		if (existingMetadata) {
			await tx
				.update(levelMetadata)
				.set(metadataValues)
				.where(eq(levelMetadata.id, existingMetadata.id))
		} else {
			await tx.insert(levelMetadata).values({
				idLevel,
				...metadataValues,
				dateCreated: now,
			})
		}

		const itemValues = {
			idLevel,
			workshopId: input.workshopId,
			authorId: input.authorId,
			name: input.name,
			imageUrl: input.imageUrl,
			fileAuthor: input.fileAuthor,
			fileUid: input.fileUid,
			validationTimeAuthor: input.validationTimeAuthor,
			validationTimeGold: input.validationTimeGold,
			validationTimeSilver: input.validationTimeSilver,
			validationTimeBronze: input.validationTimeBronze,
			deleted: false,
			createdAt: input.createdAt,
			updatedAt: input.updatedAt,
			dateUpdated: now,
		}
		if (existingItem) {
			await tx.update(levelItem).set(itemValues).where(eq(levelItem.id, existingItem.id))
		} else {
			await tx.insert(levelItem).values({ ...itemValues, dateCreated: now })
		}

		return idLevel
	})
}

export async function markMissingWorkshopLevelsDeleted(
	workshopId: bigint,
	activeFileUids: string[],
): Promise<number[]> {
	const existing = await db
		.select({ id: levelItem.id, idLevel: levelItem.idLevel, fileUid: levelItem.fileUid })
		.from(levelItem)
		.where(eq(levelItem.workshopId, workshopId))
	const missing = existing.filter((item) => !activeFileUids.includes(item.fileUid))
	if (missing.length === 0) {
		return []
	}
	await db
		.update(levelItem)
		.set({ deleted: true, dateUpdated: new Date().toISOString() })
		.where(
			inArray(
				levelItem.id,
				missing.map((item) => item.id),
			),
		)
	return [...new Set(missing.map((item) => item.idLevel))]
}

export async function markWorkshopDeleted(workshopId: bigint): Promise<number[]> {
	const rows = await db
		.selectDistinct({ idLevel: levelItem.idLevel })
		.from(levelItem)
		.where(eq(levelItem.workshopId, workshopId))
	await db
		.update(levelItem)
		.set({ deleted: true, dateUpdated: new Date().toISOString() })
		.where(eq(levelItem.workshopId, workshopId))
	return rows.map((row) => row.idLevel)
}

export async function getWorkshopUpdateTimes(): Promise<Map<bigint, string>> {
	const rows = await db
		.select({
			workshopId: levelItem.workshopId,
			updatedAt: sql<string>`MAX(${levelItem.updatedAt})`.as('updated_at'),
		})
		.from(levelItem)
		.groupBy(levelItem.workshopId)
	return new Map(rows.map((row) => [row.workshopId, row.updatedAt]))
}

export async function getLevelWorkshopAvailability(idLevel: number): Promise<{
	adventure: boolean
	itemCount: number
	accessibleItemCount: number
}> {
	const [row] = await db
		.select({
			adventure: level.adventure,
			itemCount: sql<number>`COUNT(${levelItem.id})::int`,
			accessibleItemCount: sql<number>`COUNT(${levelItem.id}) FILTER (WHERE ${levelItem.deleted} = false)::int`,
		})
		.from(level)
		.leftJoin(levelItem, eq(levelItem.idLevel, level.id))
		.where(eq(level.id, idLevel))
		.groupBy(level.id)
	return row ?? { adventure: false, itemCount: 0, accessibleItemCount: 0 }
}

export async function getLevelWorkshopAvailabilities(idLevels: number[]): Promise<
	Map<
		number,
		{
			adventure: boolean
			itemCount: number
			accessibleItemCount: number
		}
	>
> {
	if (idLevels.length === 0) {
		return new Map()
	}

	const rows = await db
		.select({
			idLevel: level.id,
			adventure: level.adventure,
			itemCount: sql<number>`COUNT(${levelItem.id})::int`,
			accessibleItemCount: sql<number>`COUNT(${levelItem.id}) FILTER (WHERE ${levelItem.deleted} = false)::int`,
		})
		.from(level)
		.leftJoin(levelItem, eq(levelItem.idLevel, level.id))
		.where(inArray(level.id, idLevels))
		.groupBy(level.id)

	return new Map(
		rows.map((row) => [
			row.idLevel,
			{
				adventure: row.adventure,
				itemCount: row.itemCount,
				accessibleItemCount: row.accessibleItemCount,
			},
		]),
	)
}
