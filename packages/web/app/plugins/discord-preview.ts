import type { HeadTag } from '@unhead/vue/types'
import {
	buildDiscordEmbed,
	DISCORD_EMBED_ID,
	discordNavigation,
	discordPageUrl,
	isDiscordPreviewPage,
} from '~/utils/discordPreview'

/** Public content pages inherit their resolved SEO metadata; feature pages supply richer data. */
export default defineNuxtPlugin((nuxtApp) => {
	const site = useSiteConfig()
	const error = useError()
	injectHead(nuxtApp)?.use({
		key: 'discord-preview',
		hooks: {
			'tags:resolve': (context: { tags: HeadTag[] }) => {
				const route = nuxtApp.$router.currentRoute.value
				if (error.value || !route.matched.length || !isDiscordPreviewPage(route.path))
					return
				const meta = (key: string) => {
					const content = context.tags.find(
						(tag) =>
							tag.tag === 'meta' &&
							(tag.props.property === key || tag.props.name === key),
					)?.props.content
					return typeof content === 'string' && content.trim() ? content : undefined
				}
				const title =
					meta('og:title') ??
					String(
						context.tags.find((tag) => tag.tag === 'title')?.textContent ??
							'ZeepCentraal',
					)
				const description =
					meta('og:description') ??
					meta('description') ??
					'Zeepkist community levels, records, and competitions.'
				const url = discordPageUrl(route.path, route.query, site.url)
				const image =
					meta('og:image') ?? new URL('/android-chrome-512x512.png', site.url).href
				for (const [property, content] of Object.entries({
					'og:title': title,
					'og:description': description,
					'og:url': url,
					'og:type': 'website',
					'og:image': image,
				})) {
					if (!meta(property))
						context.tags.push({ tag: 'meta', props: { property, content } })
				}
				if (
					context.tags.some(
						(tag) => tag.tag === 'script' && tag.props.id === DISCORD_EMBED_ID,
					)
				)
					return
				const links = discordNavigation(route.path)
				const payload = buildDiscordEmbed({ title, description, links }, url)
				if (payload)
					context.tags.push({
						tag: 'script',
						props: { id: DISCORD_EMBED_ID, type: 'application/json' },
						innerHTML: payload,
					})
			},
		},
	})
})
