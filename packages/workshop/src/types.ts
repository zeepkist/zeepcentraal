export interface WorkshopItemMetadata {
	workshopId: bigint
	creatorId: bigint
	name: string
	imageUrl: string
	createdAt: string
	updatedAt: string
	available: boolean
	permanentFailure?: string
}

export interface WorkshopCatalogPage {
	items: WorkshopItemMetadata[]
	nextCursor?: string
}

export interface WorkshopMetadataAdapter {
	getItems(workshopIds: bigint[]): Promise<WorkshopItemMetadata[]>
	listItems(cursor?: string, limit?: number): Promise<WorkshopCatalogPage>
}

export interface DownloadedWorkshopItem {
	workshopId: bigint
	directory: string
}

export interface WorkshopDownload {
	items: DownloadedWorkshopItem[]
	cleanup(): Promise<void>
}

export interface WorkshopDownloader {
	download(workshopIds: bigint[]): Promise<WorkshopDownload>
}

export interface WorkshopPersistence {
	upsertLevel(input: {
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
	}): Promise<number>
	markMissing(workshopId: bigint, activeFileUids: string[]): Promise<number[]>
	markDeleted(workshopId: bigint): Promise<number[]>
	uploadThumbnail(extension: string, contents: Buffer): Promise<string>
}

export interface WorkshopScanResult {
	workshopId: bigint
	status: 'scanned' | 'permanently-unavailable'
	changedLevelIds: number[]
}

export interface WorkshopBatchScanResult {
	results: WorkshopScanResult[]
	transientFailures: Array<{ workshopId: bigint; error: unknown }>
}
