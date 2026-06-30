import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { THUMBNAIL_FOLDER } from '../config'
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
	workshopVisibility: number
	workshopFileSize: number
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

export interface WorkshopLevelUpsertResult {
	idLevel: number
	scoreChanged: boolean
}

interface ExistingWorkshopLevelItem {
	id: number
	idLevel: number
	deleted: boolean
	xxHash: string
}

interface ExistingLevel {
	id: number
}

export function resolveWorkshopLevelId({
	inputXxHash,
	existingItem,
	existingByXxHash,
	existingByLegacyHash,
	createdLevel,
}: {
	inputXxHash: string
	existingItem?: ExistingWorkshopLevelItem
	existingByXxHash?: ExistingLevel
	existingByLegacyHash?: ExistingLevel
	createdLevel?: ExistingLevel
}): number | undefined {
	if (existingByXxHash) {
		return existingByXxHash.id
	}
	if (existingItem?.xxHash === inputXxHash) {
		return existingItem.idLevel
	}
	return existingByLegacyHash?.id ?? createdLevel?.id
}

function getImageExtensionFromContentType(contentType: string | null): string | undefined {
	const normalized = contentType?.split(';')[0]?.trim().toLowerCase()
	switch (normalized) {
		case 'image/jpeg':
		case 'image/jpg':
			return 'jpg'
		case 'image/png':
			return 'png'
		case 'image/webp':
			return 'webp'
		case 'image/avif':
			return 'avif'
		default:
			return undefined
	}
}

function hasPopulatedBlocks(blocks: unknown): boolean {
	return Array.isArray(blocks) && blocks.length > 0
}

export async function uploadWorkshopThumbnail(
	extension: string,
	contents: Buffer,
): Promise<string> {
	const normalizedExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '')
	if (!normalizedExtension) {
		throw new Error('Workshop thumbnail extension is invalid')
	}
	const objectKey = `${THUMBNAIL_FOLDER}/${generateUid()}.${normalizedExtension}`
	await uploadFile(objectKey, contents)
	return objectKey
}

async function uploadSteamWorkshopThumbnail({
	workshopId,
	imageUrl,
}: {
	workshopId: bigint
	imageUrl: string
}): Promise<string> {
	if (!imageUrl) {
		return ''
	}

	const response = await fetch(imageUrl)
	if (!response.ok) {
		throw new Error(`Steam workshop thumbnail request failed: ${response.status}`)
	}
	const contentType = response.headers.get('content-type')
	const extension = getImageExtensionFromContentType(contentType)
	if (!extension) {
		throw new Error(
			`Steam workshop thumbnail content type is unsupported: ${contentType ?? ''}`,
		)
	}

	const objectKey = `${THUMBNAIL_FOLDER}/${workshopId}.${extension}`
	await uploadFile(
		objectKey,
		Buffer.from(await response.arrayBuffer()),
		contentType ?? `image/${extension}`,
	)
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

export async function upsertWorkshopLevel(
	input: WorkshopLevelInput,
): Promise<WorkshopLevelUpsertResult> {
	const authorSteamName = await resolveSteamNameForWorkshopAuthor(input.authorId)
	const workshopImageUrl = await uploadSteamWorkshopThumbnail({
		workshopId: input.workshopId,
		imageUrl: input.workshopImageUrl,
	})
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

		const existingWorkshopItem = await tx
			.select({ visibility: workshopItem.visibility })
			.from(workshopItem)
			.where(eq(workshopItem.workshopId, input.workshopId))
			.limit(1)
			.then((rows) => rows[0])

		await tx
			.insert(workshopItem)
			.values({
				workshopId: input.workshopId,
				authorId: input.authorId,
				name: input.workshopName,
				imageUrl: workshopImageUrl,
				visibility: input.workshopVisibility,
				fileSize: input.workshopFileSize,
				createdAt: input.createdAt,
				updatedAt: input.updatedAt,
			})
			.onConflictDoUpdate({
				target: workshopItem.workshopId,
				set: {
					authorId: input.authorId,
					name: input.workshopName,
					imageUrl: workshopImageUrl,
					visibility: input.workshopVisibility,
					fileSize: input.workshopFileSize,
					createdAt: input.createdAt,
					updatedAt: input.updatedAt,
				},
			})

		const existingItemByXxHash = await tx
			.select({
				id: levelItem.id,
				idLevel: levelItem.idLevel,
				deleted: levelItem.deleted,
				xxHash: level.xxHash,
			})
			.from(levelItem)
			.innerJoin(level, eq(level.id, levelItem.idLevel))
			.where(and(eq(levelItem.workshopId, input.workshopId), eq(level.xxHash, input.xxHash)))
			.orderBy(asc(levelItem.id))
			.limit(1)
			.then((rows) => rows[0])

		const existingItemByFileUid = !existingItemByXxHash
			? await tx
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
			: undefined

		const existingItem = existingItemByXxHash ?? existingItemByFileUid
		const existingByXxHash = await tx
			.select({ id: level.id })
			.from(level)
			.where(eq(level.xxHash, input.xxHash))
			.limit(1)
			.then((rows) => rows[0])
		const existingByLegacyHash =
			!existingByXxHash && existingItem?.xxHash !== input.xxHash
				? await tx
						.select({ id: level.id, xxHash: level.xxHash })
						.from(level)
						.where(eq(level.hash, input.hash))
						.orderBy(asc(level.id))
						.then((rows) => rows.find((row) => row.xxHash === input.xxHash))
				: undefined

		let createdLevel: { id: number } | undefined
		if (!existingByXxHash && existingItem?.xxHash !== input.xxHash && !existingByLegacyHash) {
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
		const idLevel = resolveWorkshopLevelId({
			inputXxHash: input.xxHash,
			existingItem,
			existingByXxHash,
			existingByLegacyHash,
			createdLevel,
		})
		if (!idLevel) {
			throw new Error(`Unable to resolve level for hash ${input.hash}`)
		}

		if (existingByXxHash && existingByXxHash.id !== idLevel) {
			throw new Error(
				`Resolved level ${idLevel} conflicts with xxHash ${input.xxHash} owned by level ${existingByXxHash.id}`,
			)
		}

		await tx
			.update(level)
			.set({
				hash: input.hash,
				adventure: false,
				dateUpdated: now,
			})
			.where(eq(level.id, idLevel))

		const existingMetadata = await tx
			.select({ id: levelMetadata.id, blocks: levelMetadata.blocks })
			.from(levelMetadata)
			.where(eq(levelMetadata.idLevel, idLevel))
			.orderBy(asc(levelMetadata.id))
			.limit(1)
			.then((rows) => rows[0])
		const publicWorkshopItem = input.workshopVisibility === 0
		const existingMetadataHasBlocks = hasPopulatedBlocks(existingMetadata?.blocks)
		const metadataBlocks = publicWorkshopItem
			? input.blocks
			: existingMetadataHasBlocks
				? existingMetadata?.blocks
				: []
		const metadataValues = {
			amountCheckpoints: input.amountCheckpoints,
			amountFinishes: input.amountFinishes,
			amountBlocks: input.amountBlocks,
			typeGround: input.typeGround,
			typeSkybox: input.typeSkybox,
			format: input.format,
			blocks: metadataBlocks,
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

		return {
			idLevel,
			scoreChanged:
				Boolean(createdLevel) ||
				!existingItem ||
				existingItem.deleted ||
				existingItem.idLevel !== idLevel ||
				Boolean(
					existingWorkshopItem &&
						(existingWorkshopItem.visibility === 0) !== publicWorkshopItem,
				),
		}
	})
}

export async function markMissingWorkshopLevelsDeleted(
	workshopId: bigint,
	activeXxHashes: string[],
): Promise<number[]> {
	const existing = await db
		.select({ id: levelItem.id, idLevel: levelItem.idLevel, xxHash: level.xxHash })
		.from(levelItem)
		.innerJoin(level, eq(level.id, levelItem.idLevel))
		.where(and(eq(levelItem.workshopId, workshopId), eq(levelItem.deleted, false)))
	const missing = existing.filter((item) => !activeXxHashes.includes(item.xxHash))
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
		.where(and(eq(levelItem.workshopId, workshopId), eq(levelItem.deleted, false)))
	if (rows.length === 0) {
		return []
	}
	await db
		.update(levelItem)
		.set({ deleted: true, dateUpdated: new Date().toISOString() })
		.where(and(eq(levelItem.workshopId, workshopId), eq(levelItem.deleted, false)))
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

export async function getWorkshopSyncState(): Promise<
	Map<bigint, { updatedAt: string; activeItemCount: number }>
> {
	const rows = await db
		.select({
			workshopId: levelItem.workshopId,
			updatedAt: sql<string>`MAX(${levelItem.updatedAt})`.as('updated_at'),
			activeItemCount:
				sql<number>`COUNT(${levelItem.id}) FILTER (WHERE ${levelItem.deleted} = false)::int`.as(
					'active_item_count',
				),
		})
		.from(levelItem)
		.groupBy(levelItem.workshopId)
	return new Map(
		rows.map((row) => [
			row.workshopId,
			{ updatedAt: row.updatedAt, activeItemCount: row.activeItemCount },
		]),
	)
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
			accessibleItemCount: sql<number>`COUNT(${levelItem.id}) FILTER (WHERE ${levelItem.deleted} = false AND ${workshopItem.visibility} = 0)::int`,
		})
		.from(level)
		.leftJoin(levelItem, eq(levelItem.idLevel, level.id))
		.leftJoin(workshopItem, eq(workshopItem.workshopId, levelItem.workshopId))
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
			accessibleItemCount: sql<number>`COUNT(${levelItem.id}) FILTER (WHERE ${levelItem.deleted} = false AND ${workshopItem.visibility} = 0)::int`,
		})
		.from(level)
		.leftJoin(levelItem, eq(levelItem.idLevel, level.id))
		.leftJoin(workshopItem, eq(workshopItem.workshopId, levelItem.workshopId))
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
