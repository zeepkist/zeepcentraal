import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
	new URL('../../app/pages/level/[xxh128].vue', import.meta.url),
	'utf8',
).replaceAll('<Lazy', '<')
const ghostTab = readFileSync(
	new URL('../../app/components/level/LevelGhostExplorerTab.client.vue', import.meta.url),
	'utf8',
)
const detailQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/levelDetail.graphql', import.meta.url),
	'utf8',
)
const hero = readFileSync(
	new URL('../../app/components/level/LevelDetailHero.vue', import.meta.url),
	'utf8',
)
const points = readFileSync(
	new URL('../../app/components/level/LevelPointsInsights.vue', import.meta.url),
	'utf8',
)
const splits = readFileSync(
	new URL('../../app/components/level/LevelSplitAnalysis.vue', import.meta.url),
	'utf8',
)
const telemetry = readFileSync(
	new URL('../../app/components/level/LevelTelemetryPanel.vue', import.meta.url),
	'utf8',
)
const scoreBreakdown = readFileSync(
	new URL('../../app/components/level/LevelScoreBreakdown.vue', import.meta.url),
	'utf8',
)
const donut = readFileSync(
	new URL('../../app/components/dashboard/DashboardDonutChart.vue', import.meta.url),
	'utf8',
)
const driverInputs = readFileSync(
	new URL('../../app/components/dashboard/DashboardDriverInputsCard.vue', import.meta.url),
	'utf8',
)
const tooltip = readFileSync(
	new URL('../../app/components/dashboard/DashboardChartTooltip.vue', import.meta.url),
	'utf8',
)

describe('compact level detail layout', () => {
	it('keeps only active V2 and metric-only modifiers', () => {
		for (const field of ['cutPenalty', 'modifierPopularity']) {
			expect(detailQuery).not.toContain(field)
			expect(page).not.toContain(field)
		}
		for (const field of [
			'modifierLength',
			'modifierEvidence',
			'modifierQuality',
			'modifierRating',
		]) {
			expect(detailQuery).toContain(field)
		}
		expect(detailQuery).not.toContain('modifierCompetitiveness')
		expect(points).not.toContain('metrics:')
	})

	it('uses compact shared dashboard tooltips for all three line charts', () => {
		expect(points).toContain(':height="220"')
		expect(points).toContain('<DashboardChartTooltip')
		expect(points).toContain(':show-percentage="false"')
		expect(splits.match(/:height="220"/g)).toHaveLength(2)
		expect(splits.match(/<DashboardChartTooltip/g)).toHaveLength(2)
		expect(splits.match(/:show-percentage="false"/g)).toHaveLength(2)
		expect(tooltip).toContain('title?: string')
		expect(tooltip).toContain('showPercentage?: boolean')
		expect(tooltip).toContain('showPercentage: true')
	})

	it('uses dense telemetry cards while preserving dashboard defaults', () => {
		expect(telemetry).toContain('sm:grid-cols-2 xl:grid-cols-4')
		expect(telemetry).not.toContain('2xl:grid-cols-8')
		expect(telemetry).toContain('xl:grid-cols-2')
		expect(telemetry).toContain('<DashboardDonutChart')
		expect(telemetry).toContain('compact')
		expect(telemetry).not.toContain('hover:')
		expect(donut).toContain('compact?: boolean')
		expect(donut).toContain('props.compact ? 160 : 224')
		expect(driverInputs).toContain('compact?: boolean')
	})

	it('uses consistent page rhythm and a visually distinct World Record panel', () => {
		expect(page).toContain('space-y-8 lg:space-y-10')
		expect(hero).toContain('border border-primary/25 bg-default/80')
		expect(hero).toContain('shadow-sm')
		expect(hero).not.toContain('shadow-primary/10')
		expect(hero).toContain('<NuxtTime :datetime="worldRecord.dateCreated" relative />')
		expect(hero).toContain('focus-visible:outline-primary')
	})

	it('keeps overview sections visible above the detail tabs in the requested order', () => {
		const heroIndex = page.indexOf('<LevelDetailHero')
		const medalsIndex = page.indexOf('aria-labelledby="medals-heading"')
		const pointsIndex = page.indexOf('aria-labelledby="level-points-heading"')
		const splitsIndex = page.indexOf('aria-labelledby="split-analysis-heading"')
		const authorCtaIndex = page.indexOf('<AuthorLevelsCta')
		const tournamentsIndex = page.indexOf('aria-labelledby="level-tournaments-heading"')
		const tabsIndex = page.indexOf('<DetailSectionTabs')

		expect(heroIndex).toBeGreaterThan(-1)
		expect(medalsIndex).toBeGreaterThan(heroIndex)
		expect(pointsIndex).toBeGreaterThan(medalsIndex)
		expect(splitsIndex).toBeGreaterThan(pointsIndex)
		expect(authorCtaIndex).toBeGreaterThan(splitsIndex)
		expect(tournamentsIndex).toBeGreaterThan(authorCtaIndex)
		expect(tabsIndex).toBeGreaterThan(tournamentsIndex)
		expect(page).toContain('v-if="levelData.tournamentFeatures.value.length"')
		expect(page).toContain('class="grid gap-5 md:grid-cols-2"')
	})

	it('uses local Records, Telemetry, and Ghosts Explorer tabs with Records selected by default', () => {
		expect(page).toContain('v-model="activeDetailTab"')
		expect(page).toContain(':items="detailTabs"')
		expect(page).toContain(':label="$t(\'levels.detail.tabs.label\')"')
		expect(page).toContain('<template #records>')
		expect(page).toContain('<template #telemetry>')
		expect(page).toContain('<template #ghosts>')
		expect(page).toContain("type LevelDetailTab = 'records' | 'telemetry' | 'ghosts'")
		expect(page).toContain("ref<LevelDetailTab>('records')")
		expect(page).not.toMatch(/useRouteQuery|route\.query.*tab|navigateTo\([^)]*tab/)
	})

	it('gates Ghosts Explorer requests and playback behind its selected tab', () => {
		const ghostsIndex = page.indexOf('<template #ghosts>')
		const tabIndex = page.indexOf('<LevelGhostExplorerTab')
		const pickerIndex = ghostTab.indexOf('<LevelGhostExplorerPicker')
		const replayIndex = ghostTab.indexOf('<LazyRecordReplayWorkspace')

		expect(tabIndex).toBeGreaterThan(ghostsIndex)
		expect(pickerIndex).toBeGreaterThan(-1)
		expect(replayIndex).toBeGreaterThan(pickerIndex)
		expect(page).toContain("activeDetailTab.value === 'ghosts'")
		expect(ghostTab).toContain('active,')
		expect(ghostTab).toContain('useRecordLevelGeometry(levelId, active)')
		expect(page).toContain(':active="ghostExplorerActive"')
		expect(ghostTab).toContain(':follow-record-ids="ghostFollowRecordIds"')
		expect(ghostTab).toContain(
			':loading-when-empty="ghostExplorer.defaultsQuery.fetching.value"',
		)
	})

	it('stacks independently paginated personal bests before recent records', () => {
		const recordsIndex = page.indexOf('<template #records>')
		const personalBestsIndex = page.indexOf('aria-labelledby="personal-bests-heading"')
		const recentIndex = page.indexOf('aria-labelledby="recent-records-heading"')
		const telemetryIndex = page.indexOf('<template #telemetry>')

		expect(personalBestsIndex).toBeGreaterThan(recordsIndex)
		expect(recentIndex).toBeGreaterThan(personalBestsIndex)
		expect(telemetryIndex).toBeGreaterThan(recentIndex)
		expect(page).not.toContain('grid gap-8 xl:grid-cols-2 xl:items-start')
		expect(page.match(/<CursorPagination/g)).toHaveLength(2)
		expect(page).toContain('levelData.recentPagination')
		expect(page).toContain('levelData.pbPagination')
		expect(page).toContain('!levelData.recentActive.value || levelData.recent.fetching.value')
		expect(page).toContain('!levelData.personalBestsActive.value ||')
		expect(page).toContain('levelData.personalBestRanks.fetching.value')
	})

	it('keeps telemetry viewport-deferred and places scoring after statistics', () => {
		const telemetryIndex = page.indexOf('<template #telemetry>')
		const statisticsIndex = page.indexOf('aria-labelledby="level-stats-heading"')
		const scoreIndex = page.indexOf('aria-labelledby="score-breakdown-heading"')

		expect(statisticsIndex).toBeGreaterThan(telemetryIndex)
		expect(scoreIndex).toBeGreaterThan(statisticsIndex)
		expect(page).toContain(':ref="levelData.statisticsTarget"')
		expect(page).toContain(
			'!levelData.statisticsActive.value || levelData.statistics.fetching.value',
		)
	})

	it('renders score breakdown as a full-width reactor with integrated vote distribution', () => {
		expect(scoreBreakdown).toContain('class="points-reactor')
		expect(scoreBreakdown).toContain('class="reactor-map"')
		expect(scoreBreakdown).toContain('class="reactor-inspector')
		expect(scoreBreakdown).toContain('<VoteDistributionChart')
		expect(scoreBreakdown).toContain('labels.votes.title')
		expect(scoreBreakdown).not.toContain('v-for="group in groups"')
		expect(page).toContain(':points="summary.points"')
		expect(page).toContain(':vote-counts="levelData.voteDistribution.value"')
	})
})
