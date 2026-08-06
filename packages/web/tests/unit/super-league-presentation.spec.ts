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
	new URL('../../../graphql/documents/web/queries/zslRound.graphql', import.meta.url),
	'utf8',
)
const breadcrumbs = readFileSync(
	new URL('../../app/components/zsl/ZslBreadcrumbs.vue', import.meta.url),
	'utf8',
)
const facts = readFileSync(
	new URL('../../app/components/zsl/ZslPageFacts.vue', import.meta.url),
	'utf8',
)
const levelHero = readFileSync(
	new URL('../../app/components/zsl/ZslLevelHero.vue', import.meta.url),
	'utf8',
)
const seasonPage = readFileSync(
	new URL('../../app/pages/super-league/[seasonSlug]/index.vue', import.meta.url),
	'utf8',
)
const roundPage = readFileSync(
	new URL('../../app/pages/super-league/[seasonSlug]/[roundSlug]/index.vue', import.meta.url),
	'utf8',
)
const levelPage = readFileSync(
	new URL(
		'../../app/pages/super-league/[seasonSlug]/[roundSlug]/[levelSlug].vue',
		import.meta.url,
	),
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

	it('provides ancestor navigation on every nested route', () => {
		for (const page of [seasonPage, roundPage, levelPage]) {
			expect(page).toContain('<ZslBreadcrumbs')
			expect(page).toContain("to: '/super-league'")
		}
		expect(roundPage).toContain('superLeagueSeasonPath(seasonId.value)')
		expect(levelPage).toContain('superLeagueSeasonPath(parsedSeasonId)')
		expect(levelPage).toContain('superLeagueRoundPath(parsedSeasonId, parsedRoundNumber)')
		expect(breadcrumbs).not.toContain('useQuery(')
	})

	it('shows competitor and played-date facts without clickable card treatment', () => {
		expect(seasonGrid).toContain('season.zslSeasonResults.totalCount')
		expect(seasonPage).toContain(':competitor-count="competitorCount"')
		expect(roundPage).toContain(':event-date="round.eventDate"')
		expect(seasonPage).toContain('<template #actions>')
		expect(roundPage).toContain('<template #actions>')
		expect(roundPage).toContain('stacked')
		expect(levelPage).toContain(':competitor-count="competitorCount"')
		expect(facts).toContain('<NuxtTime')
		expect(facts).not.toContain('hover:-translate')
	})

	it('uses dedicated level-style thumbnail and destination actions', () => {
		expect(levelPage).toContain('<ZslLevelHero')
		expect(levelPage).toContain('steamWorkshopItemUrl(')
		expect(levelHero).toContain('<NuxtImg')
		expect(levelHero).toContain('i-tabler-brand-steam')
		expect(levelHero).toContain(':to="levelUrl"')
		expect(levelHero).toContain(':to="workshopUrl"')
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

	it('supports six round scores and compact level participation', () => {
		expect(standings).toContain('v-for="label in roundLabels"')
		expect(standings).toContain('row.roundPoints?.[index]')
		expect(standings).toContain('showLevelsPlayed')
		expect(standings).toContain('row.levelsPlayed')
		expect(seasonPage).toContain(':round-labels="roundLabels"')
		expect(roundPage).toContain('show-levels-played')
	})
})
