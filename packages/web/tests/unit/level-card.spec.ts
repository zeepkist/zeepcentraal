import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
})
