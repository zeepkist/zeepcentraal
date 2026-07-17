import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(new URL('../../app/pages/level/[xxh128].vue', import.meta.url), 'utf8')
const detailQuery = readFileSync(
	new URL('../../app/graphql/queries/levelDetail.graphql', import.meta.url),
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
	it('keeps only score-relevant legacy modifiers', () => {
		for (const field of ['cutPenalty', 'modifierLength', 'modifierPopularity']) {
			expect(detailQuery).not.toContain(field)
			expect(page).not.toContain(field)
		}
		expect(detailQuery).toContain('modifierCompetitiveness')
		expect(detailQuery).toContain('modifierRating')
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

	it('places independently paginated record sections side-by-side at xl', () => {
		expect(page).toContain('grid gap-8 xl:grid-cols-2 xl:items-start')
		expect(page.match(/<CursorPagination/g)).toHaveLength(2)
		expect(page).toContain('levelData.recentPagination')
		expect(page).toContain('levelData.pbPagination')
		expect(page).toContain(
			':pending="!levelData.recentActive.value || levelData.recent.fetching.value"',
		)
		expect(page).toContain(
			':pending="!levelData.personalBestsActive.value || levelData.personalBests.fetching.value || levelData.personalBestRanks.fetching.value"',
		)
	})
})
