import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const card = readFileSync(new URL('../../app/components/zsl/ZslCard.vue', import.meta.url), 'utf8')
const seasonGrid = readFileSync(
	new URL('../../app/components/zsl/ZslSeasonGrid.vue', import.meta.url),
	'utf8',
)
const roundGrid = readFileSync(
	new URL('../../app/components/zsl/ZslRoundGrid.vue', import.meta.url),
	'utf8',
)
const levelGrid = readFileSync(
	new URL('../../app/components/zsl/ZslLevelGrid.vue', import.meta.url),
	'utf8',
)
const standings = readFileSync(
	new URL('../../app/components/zsl/ZslStandingsTable.vue', import.meta.url),
	'utf8',
)
const frame = readFileSync(
	new URL('../../app/components/DataTableFrame.vue', import.meta.url),
	'utf8',
)
const recordTable = readFileSync(
	new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
	'utf8',
)
const topPage = readFileSync(
	new URL('../../app/pages/super-league/index.vue', import.meta.url),
	'utf8',
)
const roundQuery = readFileSync(
	new URL('../../app/graphql/queries/zslRound.graphql', import.meta.url),
	'utf8',
)

describe('Super League card presentation', () => {
	it('uses one request-free interaction shell for every card type', () => {
		for (const grid of [seasonGrid, roundGrid, levelGrid]) {
			expect(grid).toContain('<ZslCard')
			expect(grid).not.toContain('useQuery(')
			expect(grid).not.toContain('useFetch(')
		}
		expect(card).toContain('bg-gradient-to-br from-card to-primary/5')
		expect(card).toContain('hover:border-primary/50')
		expect(card).toContain('hover:shadow-primary/5')
		expect(card).toContain('motion-safe:hover:-translate-y-1')
		expect(card).toContain('motion-safe:group-hover:translate-x-1')
		expect(card).toContain('focus-visible:outline-primary')
	})

	it('does not repeat the league name in season cards', () => {
		expect(seasonGrid).not.toContain('seasonLabel')
		expect(seasonGrid).not.toContain('Zeepkist Super League')
		expect(topPage).not.toContain(':season-label=')
		expect(seasonGrid).toContain('roundsLabel(season.zslRounds.nodes.length)')
	})

	it('shows level thumbnails and names without hashes', () => {
		expect(levelGrid).toContain(':image-src=')
		expect(levelGrid).toContain('levelItems.nodes[0]?.name')
		expect(levelGrid).not.toContain('xxHash')
		expect(roundQuery).not.toContain('xxHash')
	})
})

describe('Super League standings presentation', () => {
	it('reuses the record-history table frame', () => {
		expect(frame).toContain('overflow-x-auto rounded-xl border border-border')
		expect(standings).toContain('<DataTableFrame>')
		expect(recordTable).toContain('<DataTableFrame>')
	})

	it('uses fixed accessible columns and localized values', () => {
		expect(standings).toContain('table-fixed')
		expect(standings).toContain('<colgroup>')
		expect(standings).toContain('scope="col"')
		expect(standings).toContain('new Intl.NumberFormat(locale.value)')
		expect(standings).toContain('labels.emptyValue')
		expect(standings).toContain('row.steamId')
	})
})
