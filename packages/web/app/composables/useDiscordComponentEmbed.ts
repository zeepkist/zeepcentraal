import type { DiscordPreview } from '~/utils/discordPreview'
import {
	buildDiscordEmbed,
	DISCORD_EMBED_ID,
	discordNavigation,
	discordPageUrl,
	isDiscordPreviewPage,
} from '~/utils/discordPreview'

/** Call from the page or the single feature component which owns its public data. */
export function useDiscordComponentEmbed(source: () => DiscordPreview | undefined) {
	const route = useRoute()
	const site = useSiteConfig()
	const error = useError()
	useHead(() => {
		if (error.value || !isDiscordPreviewPage(route.path)) return { script: [] }
		const preview = source()
		const payload =
			preview &&
			buildDiscordEmbed(
				{ ...preview, links: [...(preview.links ?? []), ...discordNavigation(route.path)] },
				discordPageUrl(route.path, route.query, site.url),
			)
		return {
			script: payload
				? [
						{
							key: DISCORD_EMBED_ID,
							id: DISCORD_EMBED_ID,
							type: 'application/json',
							innerHTML: payload,
						},
					]
				: [],
		}
	})
}
