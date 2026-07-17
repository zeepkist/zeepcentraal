import type { ModDetail, ModSummary } from '../../app/types/mod'
import { sanitizeModDescription } from './sanitizeModDescription'
import { getSharedCached } from './sharedCache'

export const MODIO_GAME_ID = 3213

type ModioUser = {
	username?: string
	profile_url?: string
}

type ModioLogo = {
	original?: string
	thumb_640x360?: string
}

type ModioFile = {
	version?: string
	filesize?: number
}

export type ModioMod = {
	id: number
	name: string
	name_id: string
	summary?: string
	description?: string
	profile_url?: string
	date_updated?: number
	date_live?: number
	logo?: ModioLogo
	modfile?: ModioFile
	submitted_by?: ModioUser
	tags?: Array<{ name?: string }>
	stats?: {
		downloads_total?: number
		subscribers_total?: number
		ratings_percentage_positive?: number
	}
	status?: number
	visible?: number
}

export type ModioListResponse<T> = {
	data?: T[]
	result_count?: number
	result_limit?: number
	result_offset?: number
	result_total?: number
}

export type ModioTagOption = {
	name?: string
	type?: string
	tags?: string[]
	hidden?: boolean
}

const RESERVED_MODIO_TAGS = new Set(['plugin', 'dependency', 'essentials'])

function runtimeConfig() {
	const config = useRuntimeConfig()
	const endpoint = String(config.modioApiEndpoint || '').trim()
	const apiKey = String(config.modioApiKey || '').trim()
	if (!endpoint || !apiKey) {
		throw createError({ statusCode: 503, statusMessage: 'Mod explorer is not configured' })
	}
	return { endpoint: endpoint.endsWith('/') ? endpoint : `${endpoint}/`, apiKey }
}

function cacheKey(path: string, params: Record<string, string | number | boolean>) {
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(params).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		query.set(key, String(value))
	}
	return `web:modio:${path}?${query}`
}

export async function requestModio<T>(
	path: string,
	params: Record<string, string | number | boolean> = {},
): Promise<T> {
	return getSharedCached(cacheKey(path, params), async () => {
		const { endpoint, apiKey } = runtimeConfig()
		const url = new URL(path.replace(/^\//, ''), endpoint)
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
		url.searchParams.set('api_key', apiKey)

		try {
			return (await $fetch<T>(url.toString(), { timeout: 5_000 })) as T
		} catch (error) {
			const status = Number(
				(error as { status?: number; statusCode?: number }).statusCode ??
					(error as { status?: number }).status,
			)
			if (status === 404)
				throw createError({ statusCode: 404, statusMessage: 'Mod not found' })
			throw createError({ statusCode: 502, statusMessage: 'mod.io request failed' })
		}
	})
}

export async function getModioTagOptions(): Promise<string[]> {
	const response = await requestModio<ModioListResponse<ModioTagOption>>(
		`v1/games/${MODIO_GAME_ID}/tags`,
		{ _limit: 100 },
	)
	const tags = (response.data ?? [])
		.filter((group) => !group.hidden)
		.flatMap((group) => group.tags ?? [])
		.filter((tag) => !RESERVED_MODIO_TAGS.has(tag.trim().toLowerCase()))
		.sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }))

	return [...new Set(tags)]
}

function isoDate(seconds: number | undefined): string {
	return new Date(Math.max(0, seconds ?? 0) * 1_000).toISOString()
}

export function mapModioMod(mod: ModioMod): ModSummary {
	return {
		id: mod.id,
		slug: mod.name_id,
		name: mod.name,
		summary: mod.summary?.trim() ?? '',
		authorName: mod.submitted_by?.username?.trim() || 'mod.io',
		authorUrl: mod.submitted_by?.profile_url ?? null,
		imageUrl: mod.logo?.thumb_640x360 ?? mod.logo?.original ?? null,
		profileUrl: mod.profile_url ?? `https://mod.io/g/zeepkist/m/${mod.name_id}`,
		version: mod.modfile?.version?.trim() || null,
		fileSize: mod.modfile?.filesize ?? null,
		dateUpdated: isoDate(mod.date_updated),
		dateLive: isoDate(mod.date_live),
		tags: (mod.tags ?? []).flatMap((tag) => (tag.name ? [tag.name] : [])),
		downloads: mod.stats?.downloads_total ?? 0,
		subscribers: mod.stats?.subscribers_total ?? 0,
		rating: mod.stats?.ratings_percentage_positive ?? null,
	}
}

export function mapModioDetail(mod: ModioMod): ModDetail {
	return { ...mapModioMod(mod), descriptionHtml: sanitizeModDescription(mod.description) }
}

export async function findModBySlug(slug: string): Promise<ModioMod | null> {
	const response = await requestModio<ModioListResponse<ModioMod>>(
		`v1/games/${MODIO_GAME_ID}/mods`,
		{ status: 1, visible: 1, tags: 'Plugin', name_id: slug, _limit: 1 },
	)
	return response.data?.[0] ?? null
}
