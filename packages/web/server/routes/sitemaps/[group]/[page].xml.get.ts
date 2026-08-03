export default defineEventHandler(async (event) => {
	const group = getRouterParam(event, 'group')
	const page = parseSitemapPage(getRouterParam(event, 'page'))
	if (!isSitemapGroup(group) || page === null) {
		throw createError({ statusCode: 404, statusMessage: 'Sitemap page not found' })
	}

	const maxIds = await getSitemapMaxIds(event)
	if (page >= sitemapPageCount(maxIds[group])) {
		throw createError({ statusCode: 404, statusMessage: 'Sitemap page not found' })
	}

	const entries = await fetchSitemapPage(group, page)
	setResponseHeader(event, 'content-type', 'application/xml; charset=UTF-8')
	return renderSitemapXml(entries, (path) => resolveSitemapUrl(event, path))
})
