import type { WorkshopCatalogPage, WorkshopItemMetadata, WorkshopMetadataAdapter } from './types'

interface SteamPublishedFile {
	result?: number
	publishedfileid?: string
	creator?: string
	time_created?: number
	time_updated?: number
	visibility?: number
	banned?: boolean
}

interface SteamResponse {
	response?: {
		next_cursor?: string
		publishedfiledetails?: SteamPublishedFile[]
	}
}

function parseItem(item: SteamPublishedFile): WorkshopItemMetadata {
	const workshopId = BigInt(item.publishedfileid ?? '0')
	const result = item.result ?? 0
	const available = result === 1 && item.visibility === 0 && item.banned !== true
	return {
		workshopId,
		creatorId: BigInt(item.creator ?? '0'),
		createdAt: new Date((item.time_created ?? 0) * 1000).toISOString(),
		updatedAt: new Date((item.time_updated ?? 0) * 1000).toISOString(),
		available,
		permanentFailure: available
			? undefined
			: item.banned
				? 'banned'
				: item.visibility !== 0
					? 'not-public'
					: `steam-result-${result}`,
	}
}

async function getJson(url: URL): Promise<SteamResponse> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Steam Web API request failed: ${response.status}`)
	}
	return (await response.json()) as SteamResponse
}

export class SteamWebApiMetadata implements WorkshopMetadataAdapter {
	public constructor(
		private readonly apiKey: string,
		private readonly appId: string,
		private readonly endpoint = 'https://api.steampowered.com',
	) {
		if (!apiKey) {
			throw new Error('STEAM_API_KEY is required for workshop metadata')
		}
	}

	public async getItems(workshopIds: bigint[]): Promise<WorkshopItemMetadata[]> {
		if (workshopIds.length === 0) {
			return []
		}
		const url = new URL('/IPublishedFileService/GetDetails/v1/', this.endpoint)
		url.searchParams.set('key', this.apiKey)
		for (const [index, workshopId] of workshopIds.entries()) {
			url.searchParams.set(`publishedfileids[${index}]`, workshopId.toString())
		}
		const response = await getJson(url)
		const items = (response.response?.publishedfiledetails ?? []).map(parseItem)
		const byId = new Map(items.map((item) => [item.workshopId, item]))
		return workshopIds.map(
			(workshopId) =>
				byId.get(workshopId) ?? {
					workshopId,
					creatorId: 0n,
					createdAt: new Date(0).toISOString(),
					updatedAt: new Date(0).toISOString(),
					available: false,
					permanentFailure: 'missing',
				},
		)
	}

	public async listItems(cursor = '*', limit = 100): Promise<WorkshopCatalogPage> {
		const url = new URL('/IPublishedFileService/QueryFiles/v1/', this.endpoint)
		url.searchParams.set('key', this.apiKey)
		url.searchParams.set('query_type', '1')
		url.searchParams.set('cursor', cursor)
		url.searchParams.set('numperpage', limit.toString())
		url.searchParams.set('creator_appid', this.appId)
		url.searchParams.set('appid', this.appId)
		url.searchParams.set('return_metadata', 'true')
		const response = await getJson(url)
		const nextCursor = response.response?.next_cursor
		return {
			items: (response.response?.publishedfiledetails ?? []).map(parseItem),
			nextCursor: nextCursor && nextCursor !== cursor ? nextCursor : undefined,
		}
	}
}
