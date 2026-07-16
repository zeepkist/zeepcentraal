import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createLevelRatingFormatter } from '../../app/utils/levelRating'

const card = readFileSync(
	new URL('../../app/components/level/LevelCard.vue', import.meta.url),
	'utf8',
)
const grid = readFileSync(
	new URL('../../app/components/level/LevelGrid.vue', import.meta.url),
	'utf8',
)
const zslCard = readFileSync(
	new URL('../../app/components/zsl/ZslCard.vue', import.meta.url),
	'utf8',
)
const zslGrid = readFileSync(
	new URL('../../app/components/zsl/ZslLevelGrid.vue', import.meta.url),
	'utf8',
)
const adventureQuery = readFileSync(
	new URL('../../app/graphql/queries/adventure.graphql', import.meta.url),
	'utf8',
)
const adventure = readFileSync(
	new URL('../../app/composables/useAdventure.ts', import.meta.url),
	'utf8',
)

describe('level card presentation', () => {
	it('uses shared Super League interaction treatment', () => {
		for (const source of [card, zslCard]) {
			expect(source).toContain('bg-gradient-to-br from-card to-primary/5')
			expect(source).toContain('hover:border-primary/50')
			expect(source).toContain('motion-safe:hover:-translate-y-1')
			expect(source).toContain('motion-safe:group-hover:scale-105')
			expect(source).toContain('focus-visible:outline-primary')
		}
		expect(zslGrid).toContain('<ZslCard')
	})

	it('renders optional dashboard PB and fastest-time data without requests', () => {
		expect(card).toContain('level.personalBestCount')
		expect(card).toContain('props.level.worldRecordTime ?? props.level.medals?.author')
		expect(card).toContain('worldRecordLabel')
		expect(card).toContain('authorTimeLabel')
		expect(card).not.toContain('useQuery(')
		expect(card).not.toContain('useFetch(')
		expect(grid).toContain(':personal-bests-label="personalBestsLabel"')
	})

	it('renders fixed Points, Records, PBs, and Rating metrics', () => {
		expect(card).toContain('grid-cols-4')
		expect(card.indexOf('{{ pointsLabel }}')).toBeLessThan(card.indexOf('{{ recordsLabel }}'))
		expect(card.indexOf('{{ recordsLabel }}')).toBeLessThan(
			card.indexOf('{{ personalBestsLabel }}'),
		)
		expect(card.indexOf('{{ personalBestsLabel }}')).toBeLessThan(
			card.indexOf('{{ ratingLabel }}'),
		)
		expect(card).toContain('level.points == null ? unavailableLabel')
		expect(card).toContain('level.rating == null ? unavailableLabel')
		expect(grid).toContain(':rating-label="ratingLabel"')
		expect(grid).toContain(':unavailable-label="unavailableLabel"')
	})

	it('formats ratings as localized whole percentages', () => {
		const formatter = createLevelRatingFormatter('en-GB')
		expect(formatter.format(0)).toBe('0%')
		expect(formatter.format(0.874)).toBe('87%')
		expect(formatter.format(1)).toBe('100%')
		expect(card).toContain('createLevelRatingFormatter(locale.value)')
	})

	it('loads PB counts for Adventure level cards', () => {
		expect(adventureQuery).toContain('personalBestGlobals(first: 0)')
		expect(adventure).toContain('personalBestCount: level.personalBestGlobals.totalCount')
	})

	it('supplies rating and unavailable labels from every LevelGrid context', () => {
		const contexts = [
			'../../app/pages/index.vue',
			'../../app/pages/levels.vue',
			'../../app/pages/adventure/[series].vue',
			'../../app/pages/user/[steamid].vue',
		].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
		for (const context of contexts) {
			expect(context).toContain("t('levels.card.rating')")
			expect(context).toContain("t('levels.card.unavailable')")
		}
	})
})
