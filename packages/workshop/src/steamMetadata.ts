import { STEAM_VISIBILITY } from '@zeepkist/core/steam'
import { tracedFetch } from '@zeepkist/telemetry'
import type {
	WorkshopCatalogPage,
	WorkshopItemMetadata,
	WorkshopMetadataAdapter,
	WorkshopUserItemPage,
} from './types'

interface SteamPublishedFile {
	banned?: boolean
	creator?: string
	file_size?: number | string
	preview_url?: string
	publishedfileid?: string
	result?: number
	time_created?: number
	time_updated?: number
	title?: string
	visibility?: number
}

interface SteamResponse {
	response?: {
		next_cursor?: string
		publishedfiledetails?: SteamPublishedFile[]
		startindex?: number
		total?: number
	}
}

function parseItem(item: SteamPublishedFile): WorkshopItemMetadata {
	const workshopId = BigInt(item.publishedfileid ?? '0')
	const result = item.result ?? 0
	const visibility = item.visibility ?? STEAM_VISIBILITY.Public
	const available = result === 1 && item.banned !== true
	return {
		workshopId,
		creatorId: BigInt(item.creator ?? '0'),
		name: item.title ?? '',
		imageUrl: item.preview_url ?? '',
		visibility,
		fileSize: Number(item.file_size ?? 0),
		createdAt: new Date((item.time_created ?? 0) * 1000).toISOString(),
		updatedAt: new Date((item.time_updated ?? 0) * 1000).toISOString(),
		available,
		permanentFailure: available ? undefined : item.banned ? 'banned' : `steam-result-${result}`,
	}
}

async function getJson(url: URL): Promise<SteamResponse> {
	const response = await tracedFetch(url, {}, { operationName: 'steam.webapi' })
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
		url.searchParams.set('admin_query', 'true')
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
					name: '',
					imageUrl: '',
					visibility: STEAM_VISIBILITY.Public,
					fileSize: 0,
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
		url.searchParams.set('admin_query', 'true')
		const response = await getJson(url)
		const nextCursor = response.response?.next_cursor
		return {
			items: (response.response?.publishedfiledetails ?? []).map(parseItem),
			nextCursor: nextCursor && nextCursor !== cursor ? nextCursor : undefined,
		}
	}

	public async listUserItemIds(
		uploaderId: bigint,
		page = 1,
		limit = 100,
	): Promise<WorkshopUserItemPage> {
		const url = new URL('/IPublishedFileService/GetUserFiles/v1/', this.endpoint)
		url.searchParams.set('key', this.apiKey)
		url.searchParams.set('steamid', uploaderId.toString())
		url.searchParams.set('appid', this.appId)
		url.searchParams.set('creator_appid', this.appId)
		url.searchParams.set('page', page.toString())
		url.searchParams.set('numperpage', limit.toString())
		url.searchParams.set('type', 'myfiles')
		url.searchParams.set('admin_query', 'true')
		const response = await getJson(url)
		const details = response.response?.publishedfiledetails ?? []
		const workshopIds = details.flatMap((item) =>
			item.publishedfileid ? [BigInt(item.publishedfileid)] : [],
		)
		const total = response.response?.total
		const startIndex = response.response?.startindex ?? (page - 1) * limit + 1
		const hasNextPage =
			total === undefined
				? workshopIds.length === limit
				: startIndex - 1 + workshopIds.length < total
		return {
			workshopIds,
			nextPage: hasNextPage ? page + 1 : undefined,
		}
	}
}
