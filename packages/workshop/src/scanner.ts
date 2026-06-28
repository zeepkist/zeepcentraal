import { readdir, readFile } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import { parseLevelV2 } from '@zeepkist/core/levels'
import {
	markMissingWorkshopLevelsDeleted,
	markWorkshopDeleted,
	uploadWorkshopThumbnail,
	upsertWorkshopLevel,
} from '@zeepkist/database/services/workshop'
import type {
	DownloadedWorkshopItem,
	WorkshopBatchScanResult,
	WorkshopDownloader,
	WorkshopItemMetadata,
	WorkshopMetadataAdapter,
	WorkshopPersistence,
	WorkshopScanResult,
} from './types'

interface LevelFiles {
	levelPath: string
	thumbnailPath: string
	name: string
}

const databasePersistence: WorkshopPersistence = {
	upsertLevel: upsertWorkshopLevel,
	markMissing: markMissingWorkshopLevelsDeleted,
	markDeleted: markWorkshopDeleted,
	uploadThumbnail: uploadWorkshopThumbnail,
}

async function discoverLevels(directory: string): Promise<LevelFiles[]> {
	const levels: LevelFiles[] = []
	async function visit(currentDirectory: string): Promise<void> {
		const entries = await readdir(currentDirectory, { withFileTypes: true })
		const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))
		for (const entry of entries) {
			if (entry.isDirectory()) {
				await visit(join(currentDirectory, entry.name))
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
	await visit(directory)
	if (levels.length === 0) {
		throw new Error(`Workshop item contains no complete levels: ${directory}`)
	}
	return levels
}

export class WorkshopScanner {
	public constructor(
		private readonly metadata: WorkshopMetadataAdapter,
		private readonly downloader: WorkshopDownloader,
		private readonly persistence: WorkshopPersistence = databasePersistence,
	) {}

	public async scanWorkshopItem(workshopId: bigint): Promise<WorkshopScanResult> {
		const batch = await this.scanWorkshopItems([workshopId], 1)
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
	): Promise<WorkshopBatchScanResult> {
		const metadataItems = await this.metadata.getItems(workshopIds)
		const results: WorkshopScanResult[] = []
		const available: WorkshopItemMetadata[] = []
		for (const metadata of metadataItems) {
			if (metadata.available) {
				available.push(metadata)
			} else {
				results.push({
					workshopId: metadata.workshopId,
					status: 'permanently-unavailable',
					changedLevelIds: await this.persistence.markDeleted(metadata.workshopId),
				})
			}
		}

		const metadataById = new Map(available.map((item) => [item.workshopId, item]))
		const transientFailures: Array<{ workshopId: bigint; error: unknown }> = []
		await downloadBatchesRecursively(
			available.map((item) => item.workshopId),
			async (batch) => {
				results.push(...(await this.scanDownloadedBatch(batch, metadataById)))
			},
			async (workshopId, error) => {
				transientFailures.push({ workshopId, error })
			},
			batchSize,
		)
		return { results, transientFailures }
	}

	private async scanDownloadedBatch(
		workshopIds: bigint[],
		metadataById: Map<bigint, WorkshopItemMetadata>,
	): Promise<WorkshopScanResult[]> {
		const download = await this.downloader.download(workshopIds)
		try {
			const preparedItems = await Promise.all(
				download.items.map(async (item) => {
					const metadata = metadataById.get(item.workshopId)
					if (!metadata) {
						throw new Error(`Workshop metadata ${item.workshopId} is missing`)
					}
					return {
						item,
						metadata,
						levels: await this.prepareItem(item, metadata.creatorId),
					}
				}),
			)
			if (preparedItems.length !== workshopIds.length) {
				throw new Error('SteamCMD download returned an incomplete workshop batch')
			}

			const results: WorkshopScanResult[] = []
			for (const prepared of preparedItems) {
				const changedLevelIds: number[] = []
				for (const level of prepared.levels) {
					const imageUrl = level.thumbnailPath
						? await this.persistence.uploadThumbnail(
								extname(level.thumbnailPath).slice(1),
								await readFile(level.thumbnailPath),
							)
						: ''
					const upsertResult = await this.persistence.upsertLevel({
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
						name: level.name,
						imageUrl,
						createdAt: prepared.metadata.createdAt,
						updatedAt: prepared.metadata.updatedAt,
					})
					if (upsertResult.scoreChanged) {
						changedLevelIds.push(upsertResult.idLevel)
					}
				}
				const missing = await this.persistence.markMissing(
					prepared.item.workshopId,
					prepared.levels.map((level) => level.parsed.hash),
				)
				results.push({
					workshopId: prepared.item.workshopId,
					status: 'scanned',
					changedLevelIds: [...new Set([...changedLevelIds, ...missing])],
				})
			}
			return results
		} finally {
			await download.cleanup()
		}
	}

	private async prepareItem(item: DownloadedWorkshopItem, creatorId: bigint) {
		const files = await discoverLevels(item.directory)
		return Promise.all(
			files.map(async (file) => {
				try {
					return {
						...file,
						parsed: parseLevelV2(
							await readFile(file.levelPath, 'utf8'),
							false,
							creatorId,
						),
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					throw new Error(
						`Workshop ${item.workshopId} level ${file.name} (${file.levelPath}) failed validation: ${message}`,
					)
				}
			}),
		)
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
