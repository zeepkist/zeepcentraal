import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	ADVENTURE_SERIES,
	adventureLevelNumber,
	findAdventureSeries,
	sortAdventureLevels,
} from '../../app/utils/adventureSeries'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const query = read('../../app/graphql/queries/adventure.graphql')
const composable = read('../../app/composables/useAdventure.ts')
const parent = read('../../app/pages/adventure.vue')
const index = read('../../app/pages/adventure/index.vue')
const child = read('../../app/pages/adventure/[series].vue')
const tabs = read('../../app/components/adventure/AdventureSeriesTabs.vue')
const navigation = read('../../app/utils/navigation.ts')

describe('Adventure series definitions', () => {
	it('defines every current series in alphabetical order', () => {
		expect(ADVENTURE_SERIES.map((series) => series.key)).toEqual([
			'A',
			'B',
			'C',
			'CL',
			'D',
			'E',
			'EZ',
			'F',
			'FL',
			'G',
			'H',
			'I',
			'L',
			'OR',
			'X',
			'XG',
			'Y',
		])
		expect(ADVENTURE_SERIES.map((series) => series.slug)).toEqual(
			ADVENTURE_SERIES.map((series) => series.key.toLowerCase()),
		)
		expect(ADVENTURE_SERIES.map((series) => series.prefix)).toEqual(
			ADVENTURE_SERIES.map((series) => `${series.key}-`),
		)
	})

	it('validates known lowercase slugs only', () => {
		expect(findAdventureSeries('a')?.key).toBe('A')
		expect(findAdventureSeries('xg')?.key).toBe('XG')
		expect(findAdventureSeries('A')).toBeUndefined()
		expect(findAdventureSeries('unknown')).toBeUndefined()
	})

	it('sorts naturally and excludes malformed names', () => {
		const series = findAdventureSeries('xg')
		expect(series).toBeDefined()
		if (!series) return
		expect(adventureLevelNumber('XG-04', series)).toBe(4)
		expect(adventureLevelNumber('XG-four', series)).toBeNull()
		expect(
			sortAdventureLevels(
				[{ name: 'XG-10' }, { name: 'wrong' }, { name: 'XG-02' }, { name: 'XG-01' }],
				series,
			).map((level) => level.name),
		).toEqual(['XG-01', 'XG-02', 'XG-10'])
	})
})

describe('Adventure GraphQL loading', () => {
	it('requests only count metadata for every tab', () => {
		const countsOperation = query.slice(
			query.indexOf('query ZC_AdventureSeriesCounts'),
			query.indexOf('query ZC_AdventureSeries('),
		)
		expect(countsOperation.match(/first: 0/g)).toHaveLength(17)
		expect(countsOperation.match(/totalCount/g)).toHaveLength(17)
		expect(countsOperation).not.toContain('nodes')
		for (const series of ADVENTURE_SERIES) {
			expect(countsOperation).toContain(`startsWithInsensitive: "${series.prefix}"`)
		}
	})

	it('loads only requested series nodes with complete card data', () => {
		const seriesOperation = query.slice(query.indexOf('query ZC_AdventureSeries('))
		expect(seriesOperation).toContain('$prefix: String!')
		expect(seriesOperation).toContain('first: 1000')
		expect(seriesOperation).toContain('adventure: { equalTo: true }')
		expect(seriesOperation).toContain('startsWithInsensitive: $prefix')
		expect(seriesOperation).toContain('...ZC_AdventureLevelCard')
		expect(query).toContain('validationTimeAuthor')
		expect(query).toContain('worldRecordGlobal')
		expect(query).not.toContain('ZC_AdventureLevels')
	})

	it('caches visited series without deferred catalog loading', () => {
		expect(composable).toContain('cache.has(series.slug)')
		expect(composable).toContain("requestPolicy: 'cache-first'")
		expect(composable).toContain('cache.set(series.slug')
		expect(composable).not.toContain('onMounted')
		expect(composable).not.toContain('catalog')
	})
})

describe('Adventure nested routes', () => {
	it('renders persistent tabs and selected child content', () => {
		expect(parent).toContain('<AdventureSeriesTabs')
		expect(parent).toContain('<NuxtPage />')
		expect(parent).toContain('await adventure.prefetch()')
		expect(child).toContain('<LevelGrid')
		expect(child).toContain('useAdventureContext()')
		expect(child).toContain('<script setup lang="ts">')
		expect(child).not.toContain('<script setup vapor')
	})

	it('uses native route tabs with counts and no prefetch', () => {
		expect(tabs).toContain(':to="`/adventure/')
		expect(tabs).toContain('item.slug')
		expect(tabs).toContain('flex flex-wrap gap-2')
		expect(tabs).not.toContain('overflow-x-auto')
		expect(tabs).toContain('{{ item.label }}')
		expect(parent).toContain("t('adventure.series', { series: series.key })")
		expect(tabs).toContain(':prefetch="false"')
		expect(tabs).toContain('role="tab"')
		expect(tabs).toContain('item.count')
	})

	it('redirects root, rejects unknown series, and links navigation directly to A', () => {
		expect(index).toContain("navigateTo('/adventure/a'")
		expect(index).toContain('redirectCode: 301')
		expect(child).toContain('statusCode: 404')
		expect(navigation).toContain("to: '/adventure/a'")
	})
})
