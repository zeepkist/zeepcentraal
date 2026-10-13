import { readFileSync } from 'node:fs'
import { Kind, parse } from 'graphql'
import { describe, expect, test } from 'vitest'
import {
	isSitemapGroup,
	parseSitemapPage,
	parseSitemapPageFilename,
	renderSitemapXml,
	SITEMAP_GROUPS,
	sitemapPageCount,
	sitemapPagePath,
	sitemapPageRange,
} from '../../server/utils/sitemap-pure'

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('paginated sitemaps', () => {
	test('finds maximum IDs using descending bounded connections without aggregates', () => {
		const document = parse(source('../graphql/documents/web/queries/sitemap.graphql'))
		const operation = document.definitions.find(
			(definition) =>
				definition.kind === Kind.OPERATION_DEFINITION &&
				definition.name?.value === 'ZC_SitemapMaxIds',
		)
		if (operation?.kind !== Kind.OPERATION_DEFINITION) throw new Error('Missing sitemap query')
		expect(operation.selectionSet.selections).toHaveLength(7)
		for (const field of operation.selectionSet.selections) {
			if (field.kind !== Kind.FIELD) throw new Error('Unexpected selection')
			expect(
				field.arguments?.find((argument) => argument.name.value === 'first')?.value,
			).toMatchObject({ value: '1' })
			expect(
				field.arguments?.find((argument) => argument.name.value === 'orderBy')?.value,
			).toMatchObject({ values: [{ value: 'ID_DESC' }] })
			expect(field.selectionSet?.selections).toMatchObject([{ name: { value: 'nodes' } }])
		}
	})
	test('uses stable 1000-ID windows', () => {
		expect(sitemapPageCount(0)).toBe(0)
		expect(sitemapPageCount(1)).toBe(1)
		expect(sitemapPageCount(1000)).toBe(1)
		expect(sitemapPageCount(1001)).toBe(2)
		expect(sitemapPageRange(0)).toEqual({ startId: 1, endId: 1001 })
		expect(sitemapPageRange(7)).toEqual({ startId: 7001, endId: 8001 })
	})

	test('accepts only canonical group and page paths', () => {
		for (const group of SITEMAP_GROUPS) {
			expect(isSitemapGroup(group)).toBe(true)
			expect(sitemapPagePath(group, 2)).toBe(`/sitemaps/${group}/2.xml`)
		}
		expect(isSitemapGroup('mods')).toBe(false)
		expect(parseSitemapPage('0')).toBe(0)
		expect(parseSitemapPage('12')).toBe(12)
		expect(parseSitemapPage('01')).toBeNull()
		expect(parseSitemapPage('-1')).toBeNull()
		expect(parseSitemapPage('2147483')).toBeNull()
		expect(parseSitemapPageFilename('0.xml')).toBe(0)
		expect(parseSitemapPageFilename('12.xml')).toBe(12)
		expect(parseSitemapPageFilename('01.xml')).toBeNull()
		expect(parseSitemapPageFilename('12')).toBeNull()
		expect(parseSitemapPageFilename('12.xml.xml')).toBeNull()
	})

	test('captures sitemap filename as one Nitro route parameter', () => {
		const route = source('server/routes/sitemaps/[group]/[page].get.ts')
		expect(route).toContain("parseSitemapPageFilename(getRouterParam(event, 'page'))")
	})

	test('renders canonical escaped XML with sitemap defaults', () => {
		const xml = renderSitemapXml(
			[{ loc: '/level/a&b', lastmod: '2026-08-02T12:00:00.000Z' }],
			(path) => `https://zeepki.st${path}?x=<value>`,
		)
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
		expect(xml).toContain('<loc>https://zeepki.st/level/a&amp;b?x=&lt;value&gt;</loc>')
		expect(xml).toContain('<lastmod>2026-08-02T12:00:00.000Z</lastmod>')
		expect(xml).toContain('<changefreq>daily</changefreq>')
		expect(xml).toContain('<priority>0.7</priority>')
	})

	test('queries every requested public dataset without nested caps', () => {
		const query = source('../graphql/documents/web/queries/sitemap.graphql')
		expect(query.match(/first: 1000/g)).toHaveLength(7)
		expect(query).toContain('banned: { equalTo: false }')
		expect(query.match(/publiclyVisible: \{ equalTo: true \}/g)).toHaveLength(4)
		expect(query).toContain('type: { in: [0, 1] }')
		expect(query).toContain('query ZC_SitemapSuperLeagueSeasonsPage')
		expect(query).toContain('query ZC_SitemapSuperLeagueRoundsPage')
		expect(query).toContain('query ZC_SitemapSuperLeagueLevelsPage')
		expect(query).not.toContain('zslRounds(first: 6')
		expect(query).not.toContain('zslLevels(first: 15')
	})

	test('keeps private and non-canonical pages outside app sitemap', () => {
		const config = source('nuxt.config.ts')
		expect(config).toContain("'/records/me': { robots: false, sitemap: false }")
		expect(config).toContain("'/settings': { robots: false, sitemap: false }")
		expect(config).toContain("disallow: ['/records/me', '/settings']")
		expect(config).toContain("'/adventure': { sitemap: false }")
		expect(config).toContain("'/totd': { sitemap: false }")
		expect(config).toContain('urls: ADVENTURE_SERIES.map')
	})

	test('maps tournaments only to TOTW and TOTM route helper', () => {
		const implementation = source('server/utils/sitemap.ts')
		expect(implementation).toContain("case 'tournaments'")
		expect(implementation).toContain('tournament.type !== 0 && tournament.type !== 1')
		expect(implementation).toContain('tournamentPath(tournament.type, tournament.slug)')
	})
})
