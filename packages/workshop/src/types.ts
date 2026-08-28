export interface WorkshopItemMetadata {
	available: boolean
	createdAt: string
	creatorId: bigint
	fileSize: number
	imageUrl: string
	name: string
	permanentFailure?: string
	updatedAt: string
	visibility: number
	workshopId: bigint
}

export interface WorkshopCatalogPage {
	items: WorkshopItemMetadata[]
	nextCursor?: string
}

export interface WorkshopUserItemPage {
	nextPage?: number
	workshopIds: bigint[]
}

export interface WorkshopMetadataAdapter {
	getItems(workshopIds: bigint[]): Promise<WorkshopItemMetadata[]>
	listItems(cursor?: string, limit?: number): Promise<WorkshopCatalogPage>
	listUserItemIds(
		uploaderId: bigint,
		page?: number,
		limit?: number,
	): Promise<WorkshopUserItemPage>
}

export interface DownloadedWorkshopItem {
	directory: string
	workshopId: bigint
}

export interface WorkshopDownload extends AsyncDisposable {
	cleanup(): Promise<void>
	items: DownloadedWorkshopItem[]
}

export interface WorkshopDownloader {
	download(workshopIds: bigint[]): Promise<WorkshopDownload>
}

export interface WorkshopPersistence {
	findLevelAuthorByXxHash(xxHash: string, excludedUploaderId: bigint): Promise<bigint | undefined>
	markDeleted(workshopId: bigint, workshopVisibility: number): Promise<number[]>
	markMissing(workshopId: bigint, activeXxHashes: string[]): Promise<number[]>
	mergeZeepSdkExponentHash?(input: {
		correctLevelId: number
		correctXxHash: string
		badXxHash: string
		workshopId: bigint
		fileUid: string
	}): Promise<{ merged: boolean; changedLevelIds: number[] }>
	uploadThumbnail(extension: string, contents: Uint8Array | Blob): Promise<string>
	upsertLevel(input: {
		hash: string
		xxHash: string
		workshopId: bigint
		workshopName: string
		workshopImageUrl: string
		workshopVisibility: number
		workshopFileSize: number
		authorId: bigint
		levelAuthorId: bigint
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
	}): Promise<{ idLevel: number; scoreChanged: boolean }>
}

export interface WorkshopScanOptions {
	fixZeepSDKExponentHashes?: boolean
}

export interface WorkshopScanResult {
	changedLevelIds: number[]
	status: 'scanned' | 'permanently-unavailable' | 'inaccessible'
	workshopId: bigint
}

export interface WorkshopBatchScanResult {
	results: WorkshopScanResult[]
	transientFailures: Array<{ workshopId: bigint; error: unknown }>
}
