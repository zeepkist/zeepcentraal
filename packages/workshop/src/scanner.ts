import { readdir } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import { calculateLegacyZeepSdkJsonXxHash, levelFormat, parseLevelV2 } from '@zeepkist/core/levels'
import { canSteamCmdDownloadWorkshopItem, STEAM_VISIBILITY } from '@zeepkist/core/steam'
import { withActiveSpan } from '@zeepkist/telemetry'
import type {
	DownloadedWorkshopItem,
	WorkshopBatchScanResult,
	WorkshopDownloader,
	WorkshopItemMetadata,
	WorkshopMetadataAdapter,
	WorkshopPersistence,
	WorkshopScanOptions,
	WorkshopScanResult,
} from './types'

interface LevelFiles {
	levelPath: string
	name: string
	thumbnailPath: string
}

type PreparedLevel = LevelFiles & {
	parsed: ReturnType<typeof parseLevelV2>
	legacyZeepSdkXxHash?: string
}

const MAX_LEVEL_FILE_BYTES = 64 * 1024 * 1024
const MAX_THUMBNAIL_BYTES = 16 * 1024 * 1024
const MAX_WORKSHOP_ENTRIES = 4_096
const MAX_WORKSHOP_DEPTH = 16

export const ZSL_WORKSHOP_AUTHOR_ID = 76561198031919228n

let databasePersistence: WorkshopPersistence | undefined

async function getDatabasePersistence(): Promise<WorkshopPersistence> {
	if (!databasePersistence) {
		const service = await import('@zeepkist/database/services/workshop')
		databasePersistence = {
			findLevelAuthorByXxHash: service.findWorkshopLevelAuthorByXxHash,
			upsertLevel: service.upsertWorkshopLevel,
			markMissing: service.markMissingWorkshopLevelsDeleted,
			markDeleted: service.markWorkshopDeleted,
			uploadThumbnail: service.uploadWorkshopThumbnail,
			mergeZeepSdkExponentHash: service.mergeZeepSdkExponentHash,
		}
	}
	return databasePersistence
}

async function discoverLevels(directory: string): Promise<LevelFiles[]> {
	const levels: LevelFiles[] = []
	let visitedEntries = 0
	async function visit(currentDirectory: string, depth: number): Promise<void> {
		if (depth > MAX_WORKSHOP_DEPTH)
			throw new Error('Workshop item directory nesting is too deep')
		const entries = await readdir(currentDirectory, { withFileTypes: true })
		const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))
		for (const entry of entries) {
			visitedEntries++
			if (visitedEntries > MAX_WORKSHOP_ENTRIES) {
				throw new Error('Workshop item contains too many files')
			}
			if (entry.isDirectory()) {
				await visit(join(currentDirectory, entry.name), depth + 1)
				continue
			}
			if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.zeeplevel') {
				continue
			}
			const baseName = parse(entry.name).name
			const thumbnailName = [...files].find(
				(name) => name.toLowerCase() === `${baseName.toLowerCase()}_thumbnail.jpg`,
			)
			levels.push({
				levelPath: join(currentDirectory, entry.name),
				thumbnailPath: thumbnailName ? join(currentDirectory, thumbnailName) : '',
				name: baseName,
			})
		}
	}
	await visit(directory, 0)
	if (levels.length === 0) {
		throw new Error(`Workshop item contains no complete levels: ${directory}`)
	}
	return levels
}

export class WorkshopScanner {
	public constructor(
		private readonly metadata: WorkshopMetadataAdapter,
		private readonly downloader: WorkshopDownloader,
		private readonly persistence?: WorkshopPersistence,
	) {}

	private async getPersistence(): Promise<WorkshopPersistence> {
		return this.persistence ?? getDatabasePersistence()
	}

	public async scanWorkshopItem(
		workshopId: bigint,
		options: WorkshopScanOptions = {},
	): Promise<WorkshopScanResult> {
		const batch = await this.scanWorkshopItems([workshopId], 1, options)
		const failure = batch.transientFailures[0]
		if (failure) {
			throw failure.error
		}
		const result = batch.results[0]
		if (!result) {
			throw new Error(`Workshop scan produced no result for ${workshopId}`)
		}
		return result
	}

	public async scanWorkshopItems(
		workshopIds: bigint[],
		batchSize = 10,
		options: WorkshopScanOptions = {},
	): Promise<WorkshopBatchScanResult> {
		return withActiveSpan(
			'workshop.scan',
			{ attributes: { 'workshop.item.count': workshopIds.length } },
			async (span) => {
				const persistence = await this.getPersistence()
				const metadataItems = await this.metadata.getItems(workshopIds)
				const results: WorkshopScanResult[] = []
				const available: WorkshopItemMetadata[] = []
				for (const metadata of metadataItems) {
					if (!metadata.available) {
						results.push({
							workshopId: metadata.workshopId,
							status: 'permanently-unavailable',
							changedLevelIds: await persistence.markDeleted(
								metadata.workshopId,
								STEAM_VISIBILITY.Hidden,
							),
						})
					} else if (!canSteamCmdDownloadWorkshopItem(metadata.visibility)) {
						results.push({
							workshopId: metadata.workshopId,
							status: 'inaccessible',
							changedLevelIds: await persistence.markDeleted(
								metadata.workshopId,
								metadata.visibility,
							),
						})
					} else {
						available.push(metadata)
					}
				}

				const metadataById = new Map(available.map((item) => [item.workshopId, item]))
				const transientFailures: Array<{ workshopId: bigint; error: unknown }> = []
				await downloadBatchesRecursively(
					available.map((item) => item.workshopId),
					async (batch) => {
						results.push(
							...(await this.scanDownloadedBatch(
								batch,
								metadataById,
								options,
								persistence,
							)),
						)
					},
					async (workshopId, error) => {
						transientFailures.push({ workshopId, error })
					},
					batchSize,
				)
				span.addEvent('workshop.scan.completed', {
					'workshop.result.count': results.length,
					'workshop.failure.count': transientFailures.length,
				})
				return { results, transientFailures }
			},
		)
	}

	private async scanDownloadedBatch(
		workshopIds: bigint[],
		metadataById: Map<bigint, WorkshopItemMetadata>,
		options: WorkshopScanOptions,
		persistence: WorkshopPersistence,
	): Promise<WorkshopScanResult[]> {
		return withActiveSpan(
			'workshop.download.persist',
			{ attributes: { 'workshop.item.count': workshopIds.length } },
			async (span) => {
				await using download = await this.downloader.download(workshopIds)
				{
					const preparedItems: Array<{
						item: DownloadedWorkshopItem
						metadata: WorkshopItemMetadata
						levels: PreparedLevel[]
					}> = []
					for (const item of download.items) {
						const metadata = metadataById.get(item.workshopId)
						if (!metadata) {
							throw new Error(`Workshop metadata ${item.workshopId} is missing`)
						}
						preparedItems.push({
							item,
							metadata,
							levels: await this.prepareItem(item, metadata.creatorId, options),
						})
					}
					if (preparedItems.length !== workshopIds.length) {
						throw new Error('SteamCMD download returned an incomplete workshop batch')
					}

					const results: WorkshopScanResult[] = []
					for (const prepared of preparedItems) {
						const changedLevelIds: number[] = []
						for (const level of prepared.levels) {
							const levelAuthorId = await this.resolveLevelAuthor(
								prepared.metadata.creatorId,
								level.parsed.hash,
								persistence,
							)
							let imageUrl = ''
							if (level.thumbnailPath) {
								const thumbnail = Bun.file(level.thumbnailPath)
								if (thumbnail.size > MAX_THUMBNAIL_BYTES) {
									throw new Error('Workshop thumbnail is too large')
								}
								imageUrl = await persistence.uploadThumbnail(
									extname(level.thumbnailPath).slice(1),
									thumbnail,
								)
							}
							const upsertResult = await persistence.upsertLevel({
								...level.parsed,
								xxHash: level.parsed.hash,
								hash: level.parsed.zeepHash,
								fileUid: level.parsed.uid,
								workshopId: prepared.item.workshopId,
								workshopName: prepared.metadata.name,
								workshopImageUrl: prepared.metadata.imageUrl,
								workshopVisibility: prepared.metadata.visibility,
								workshopFileSize: prepared.metadata.fileSize,
								authorId: prepared.metadata.creatorId,
								levelAuthorId,
								name: level.name,
								imageUrl,
								createdAt: prepared.metadata.createdAt,
								updatedAt: prepared.metadata.updatedAt,
							})
							if (upsertResult.scoreChanged) {
								changedLevelIds.push(upsertResult.idLevel)
							}
							if (
								options.fixZeepSDKExponentHashes &&
								level.legacyZeepSdkXxHash &&
								level.legacyZeepSdkXxHash !== level.parsed.hash &&
								persistence.mergeZeepSdkExponentHash
							) {
								const merge = await persistence.mergeZeepSdkExponentHash({
									correctLevelId: upsertResult.idLevel,
									correctXxHash: level.parsed.hash,
									badXxHash: level.legacyZeepSdkXxHash,
									workshopId: prepared.item.workshopId,
									fileUid: level.parsed.uid,
								})
								if (merge.merged) {
									changedLevelIds.push(...merge.changedLevelIds)
								}
							}
						}
						const missing = await persistence.markMissing(
							prepared.item.workshopId,
							prepared.levels.map((level) => level.parsed.hash),
						)
						results.push({
							workshopId: prepared.item.workshopId,
							status: 'scanned',
							changedLevelIds: [...new Set([...changedLevelIds, ...missing])],
						})
					}
					span.addEvent('workshop.persistence.completed', {
						'workshop.result.count': results.length,
					})
					return results
				}
			},
		)
	}

	private async resolveLevelAuthor(
		workshopAuthorId: bigint,
		xxHash: string,
		persistence: WorkshopPersistence,
	): Promise<bigint> {
		if (workshopAuthorId !== ZSL_WORKSHOP_AUTHOR_ID) {
			return workshopAuthorId
		}
		return (
			(await persistence.findLevelAuthorByXxHash(xxHash, ZSL_WORKSHOP_AUTHOR_ID)) ??
			workshopAuthorId
		)
	}

	private async prepareItem(
		item: DownloadedWorkshopItem,
		creatorId: bigint,
		options: WorkshopScanOptions,
	): Promise<PreparedLevel[]> {
		return withActiveSpan('workshop.parse', async (span) => {
			const files = await discoverLevels(item.directory)
			span.addEvent('workshop.files.discovered', { 'workshop.level.count': files.length })
			const prepared: PreparedLevel[] = []
			for (const file of files) {
				try {
					const levelFile = Bun.file(file.levelPath)
					if (levelFile.size > MAX_LEVEL_FILE_BYTES)
						throw new Error('Level file is too large')
					const content = await levelFile.text()
					const parsed = parseLevelV2(content, false, creatorId)
					let legacyZeepSdkXxHash: string | undefined
					if (options.fixZeepSDKExponentHashes && parsed.format === levelFormat.json) {
						try {
							legacyZeepSdkXxHash = calculateLegacyZeepSdkJsonXxHash(content)
						} catch {
							legacyZeepSdkXxHash = undefined
						}
					}
					prepared.push({
						...file,
						parsed,
						legacyZeepSdkXxHash,
					})
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					throw new Error(
						`Workshop ${item.workshopId} level ${file.name} (${file.levelPath}) failed validation: ${message}`,
					)
				}
			}
			return prepared
		})
	}
}

export async function downloadBatchesRecursively(
	workshopIds: bigint[],
	download: (workshopIds: bigint[]) => Promise<void>,
	onSingleFailure: (workshopId: bigint, error: unknown) => Promise<void>,
	batchSize = 10,
): Promise<void> {
	async function runBatch(batch: bigint[]): Promise<void> {
		try {
			await download(batch)
		} catch (error) {
			if (batch.length === 1) {
				await onSingleFailure(batch[0] as bigint, error)
				return
			}
			const midpoint = Math.ceil(batch.length / 2)
			await runBatch(batch.slice(0, midpoint))
			await runBatch(batch.slice(midpoint))
		}
	}
	for (let index = 0; index < workshopIds.length; index += batchSize) {
		await runBatch(workshopIds.slice(index, index + batchSize))
	}
}
