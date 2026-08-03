export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook('sitemap:index-resolved', async ({ event, sitemaps }) => {
		const maxIds = await getSitemapMaxIds(event)
		for (const group of SITEMAP_GROUPS) {
			const pageCount = sitemapPageCount(maxIds[group])
			for (let page = 0; page < pageCount; page++) {
				sitemaps.push({ sitemap: resolveSitemapUrl(event, sitemapPagePath(group, page)) })
			}
		}
	})
})
