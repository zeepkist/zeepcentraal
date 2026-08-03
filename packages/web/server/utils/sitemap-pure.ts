export const SITEMAP_PAGE_SIZE = 1000
export const SITEMAP_GROUPS = [
	'users',
	'levels',
	'records',
	'tournaments',
	'super-league-seasons',
	'super-league-rounds',
	'super-league-levels',
] as const

export type SitemapGroup = (typeof SITEMAP_GROUPS)[number]

export interface SitemapEntry {
	lastmod: string
	loc: string
}

export type SitemapMaxIds = Record<SitemapGroup, number>

const MAX_GRAPHQL_INT = 2_147_483_647
const MAX_SITEMAP_PAGE = Math.floor((MAX_GRAPHQL_INT - 1) / SITEMAP_PAGE_SIZE) - 1

export function isSitemapGroup(value: string | undefined): value is SitemapGroup {
	return SITEMAP_GROUPS.some((group) => group === value)
}

export function parseSitemapPage(value: string | undefined): number | null {
	if (!value || !/^(0|[1-9]\d*)$/.test(value)) return null
	const page = Number(value)
	return Number.isSafeInteger(page) && page <= MAX_SITEMAP_PAGE ? page : null
}

export function parseSitemapPageFilename(value: string | undefined): number | null {
	if (!value?.endsWith('.xml')) return null
	return parseSitemapPage(value.slice(0, -4))
}

export function sitemapPageCount(maxId: number): number {
	return maxId > 0 ? Math.ceil(maxId / SITEMAP_PAGE_SIZE) : 0
}

export function sitemapPageRange(page: number): { startId: number; endId: number } {
	return {
		startId: page * SITEMAP_PAGE_SIZE + 1,
		endId: (page + 1) * SITEMAP_PAGE_SIZE + 1,
	}
}

export function sitemapPagePath(group: SitemapGroup, page: number): string {
	return `/sitemaps/${group}/${page}.xml`
}

export function renderSitemapXml(
	entries: readonly SitemapEntry[],
	resolveUrl: (path: string) => string,
): string {
	const urls = entries.map((entry) =>
		[
			'\t<url>',
			`\t\t<loc>${escapeSitemapXml(resolveUrl(entry.loc))}</loc>`,
			`\t\t<lastmod>${escapeSitemapXml(entry.lastmod)}</lastmod>`,
			'\t\t<changefreq>daily</changefreq>',
			'\t\t<priority>0.7</priority>',
			'\t</url>',
		].join('\n'),
	)

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls,
		'</urlset>',
	].join('\n')
}

function escapeSitemapXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;')
}
