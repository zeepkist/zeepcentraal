import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getLevelDisplayName, LEVEL_HASH_DISPLAY_LENGTH } from '../../app/utils/levelDisplay'

const query = (name: string) =>
	readFileSync(new URL(`../../app/graphql/queries/${name}.graphql`, import.meta.url), 'utf8')
const source = (path: string) => readFileSync(new URL(`../../app/${path}`, import.meta.url), 'utf8')

describe('private level metadata presentation', () => {
	it('uses metadata names when available and exact ten-character hash fallbacks', () => {
		const hash = '0123456789abcdef0123456789abcdef'
		expect(LEVEL_HASH_DISPLAY_LENGTH).toBe(10)
		expect(getLevelDisplayName('Visible level', hash)).toBe('Visible level')
		expect(getLevelDisplayName(null, hash)).toBe('0123456789')
		expect(getLevelDisplayName(undefined, hash)).not.toContain('…')
	})

	it('filters every public level discovery surface', () => {
		const visibilityFilter = 'publiclyVisible: { equalTo: true }'
		const expectedFilterCounts = {
			adventure: 18,
			dashboard: 5,
			dashboardViewer: 1,
			homeStats: 1,
			search: 1,
			sitemapLevels: 1,
			userLevels: 2,
		} as const

		for (const [document, expectedCount] of Object.entries(expectedFilterCounts)) {
			expect(query(document).split(visibilityFilter)).toHaveLength(expectedCount + 1)
		}
		expect(query('levels')).toContain('filter: $filter')
		expect(source('utils/levelExplorer.ts')).toContain('{ publiclyVisible: { equalTo: true } }')
	})

	it('keeps record-derived level relations unfiltered', () => {
		for (const document of [
			'recordHistory',
			'userResults',
			'userContributions',
			'levelRecords',
		]) {
			expect(query(document), document).not.toContain('publiclyVisible: { equalTo: true }')
		}
	})

	it('loads direct detail routes but prevents indexing hidden metadata', () => {
		expect(query('levelDetail')).toContain('publiclyVisible')
		expect(query('recordDetail')).toContain('publiclyVisible')
		expect(source('composables/useLevelDetail.ts')).toContain(
			'value.publiclyVisible ? value.levelItems.nodes[0] : undefined',
		)
		expect(source('pages/level/[xxh128].vue')).toContain("'noindex, nofollow'")
		const recordPage = source('pages/record/[recordId].vue')
		expect(recordPage).toContain("'noindex, nofollow'")
		expect(recordPage).toContain(
			'record.value?.level?.publiclyVisible ? levelItem.value : null',
		)
		expect(recordPage).toContain(':image-url="publicLevelItem?.imageUrl"')
		expect(source('components/level/LevelDetailHero.vue')).toContain(
			'v-if="level.publiclyVisible"',
		)
	})
})
