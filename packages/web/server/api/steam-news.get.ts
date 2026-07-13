import type { SteamNewsItem } from '../../app/types/app'
import { assertSameOrigin } from '../utils/request'

type SteamNewsResponse = {
	appnews?: {
		newsitems?: Array<{
			gid: string
			title: string
			url: string
			author: string
			date: number
			contents: string
		}>
	}
}

function textOnly(value: string) {
	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim()
}

export default defineCachedEventHandler(
	async (event) => {
		assertSameOrigin(event)
		const response = await $fetch<SteamNewsResponse>(
			'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/',
			{
				query: { appid: 1440670, count: 6, maxlength: 500, format: 'json' },
				timeout: 5_000,
			},
		)
		return (response.appnews?.newsitems ?? []).slice(0, 6).map(
			(item): SteamNewsItem => ({
				id: item.gid,
				title: textOnly(item.title),
				url: item.url.startsWith('https://')
					? item.url
					: 'https://store.steampowered.com/app/1440670/',
				author: textOnly(item.author),
				date: new Date(item.date * 1_000).toISOString(),
				contents: textOnly(item.contents),
			}),
		)
	},
	{ name: 'steam-news', maxAge: 15 * 60, staleMaxAge: 60 * 60 },
)
