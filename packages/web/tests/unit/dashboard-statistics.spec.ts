import { readFileSync } from 'node:fs'
import { Kind, parse } from 'graphql'
import { describe, expect, it } from 'vitest'

const querySource = readFileSync(
	new URL('../../app/graphql/queries/dashboard.graphql', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useDashboard.ts', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
const model = readFileSync(
	new URL('../../app/composables/useDashboardStatisticsModel.ts', import.meta.url),
	'utf8',
)
const panel = readFileSync(
	new URL('../../app/components/dashboard/DashboardStatisticsPanel.vue', import.meta.url),
	'utf8',
)
const chartCard = readFileSync(
	new URL('../../app/components/dashboard/DashboardStatisticChartCard.vue', import.meta.url),
	'utf8',
)
const chartLegend = readFileSync(
	new URL('../../app/components/dashboard/DashboardChartLegend.vue', import.meta.url),
	'utf8',
)
const chartTooltip = readFileSync(
	new URL('../../app/components/dashboard/DashboardChartTooltip.vue', import.meta.url),
	'utf8',
)
const donutChart = readFileSync(
	new URL('../../app/components/dashboard/DashboardDonutChart.vue', import.meta.url),
	'utf8',
)
const driverInputs = readFileSync(
	new URL('../../app/components/dashboard/DashboardDriverInputsCard.vue', import.meta.url),
	'utf8',
)

describe('dashboard statistic aggregates', () => {
	it('uses five count-only aggregate connections with bounded period filters', () => {
		const document = parse(querySource)
		const operation = document.definitions.find(
			(definition) =>
				definition.kind === Kind.OPERATION_DEFINITION &&
				definition.name?.value === 'ZC_DashboardStatistics',
		)
		expect(operation?.kind).toBe(Kind.OPERATION_DEFINITION)
		if (operation?.kind !== Kind.OPERATION_DEFINITION) return

		const connections = operation.selectionSet.selections.filter(
			(selection) =>
				selection.kind === Kind.FIELD && selection.name.value === 'recordStatistics',
		)
		expect(connections).toHaveLength(5)
		for (const connection of connections) {
			if (connection.kind !== Kind.FIELD) continue
			expect(
				connection.arguments?.find((argument) => argument.name.value === 'first'),
			).toMatchObject({ value: { kind: Kind.INT, value: '0' } })
			expect(connection.arguments?.some((argument) => argument.name.value === 'offset')).toBe(
				false,
			)
		}

		expect(querySource).toContain('allTimeStatistics: recordStatistics(first: 0)')
		expect(querySource).toContain('dayStatistics: recordStatistics(')
		expect(querySource).toContain('monthStatistics: recordStatistics(')
		expect(querySource).toContain('v6DayStatistics: recordStatistics(')
		expect(querySource).toContain('v6MonthStatistics: recordStatistics(')
		expect(
			querySource.match(/modVersion: \{ greaterThanOrEqualTo: \$minimumModVersion \}/g),
		).toHaveLength(2)
		expect(composable).toContain("minimumModVersion: '1.2.0'")
		expect(composable).toContain('daySince: ssrMetricWindows.value.daySince')
		expect(composable).toContain('monthSince: ssrMetricWindows.value.monthSince')
		expect(composable).not.toContain('daySince: liveMetricWindows.value.daySince')
		expect(composable).not.toContain('monthSince: liveMetricWindows.value.monthSince')
	})

	it('requests every displayed sum and average field', () => {
		for (const field of [
			'distanceOnTarmac',
			'distanceOnGrass',
			'distanceOnSand',
			'distanceOnIce',
			'distanceOnMetal',
			'distanceOnSnow',
			'distanceOnSoap',
			'timeOnTarmac',
			'timeOnGround',
			'distanceOn4Wheels',
			'distanceOn1Wheel',
			'turnLeftCount',
			'turnRightCount',
			'armsUpCount',
			'brakeCount',
			'hornCount',
			'averageSpeed',
		]) {
			expect(querySource).toContain(field)
		}
	})
})

describe('dashboard statistic presentation', () => {
	it('uses request-free reusable Nuxt chart components', () => {
		expect(page).toContain('<DashboardStatisticsPanel :model="statisticsModel" />')
		expect(page).not.toContain('<BarChart')
		expect(page).not.toContain('totalMetrics')
		expect(panel).toContain('<DashboardStatisticChartCard')
		expect(chartCard).toContain('<DashboardDonutChart')
		expect(chartCard).toContain('<BarChart')
		expect(donutChart).toContain('<DonutChart')
		expect(donutChart).toContain("half ? 'half' : 'full'")
		for (const source of [
			panel,
			chartCard,
			chartLegend,
			chartTooltip,
			donutChart,
			driverInputs,
		]) {
			expect(source).not.toContain('useQuery(')
			expect(source).not.toContain('useFetch(')
		}
	})

	it('supports period switching, reduced motion, and derived zero-wheel distance', () => {
		expect(panel).toContain("period = 'today'")
		expect(panel).toContain("period = 'month'")
		expect(chartCard).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
		expect(donutChart).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
		expect(chartCard).toContain('reducedMotion.value ? 0 : 650')
		expect(donutChart).toContain('reducedMotion.value ? 0 : 650')
		expect(model).toContain('Math.max(')
		expect(model).toContain('distanceOn4Wheels')
		expect(model).toContain('distanceOn1Wheel')
		expect(model).not.toContain('useQuery(')
	})

	it('uses flat static surfaces, horizontal bars, and exact custom tooltips', () => {
		expect(panel).not.toContain('rounded-3xl border border-primary/15')
		expect(panel).not.toContain('hover:border-primary')
		expect(panel).not.toContain('hover:-translate')
		expect(chartCard).not.toContain('hover:border-primary')
		expect(chartCard).not.toContain('hover:-translate')
		expect(chartCard).toContain('orientation="horizontal"')
		expect(donutChart).toContain('md:grid-cols-[minmax(0,0.95fr)_minmax(13rem,1.05fr)]')
		expect(chartCard).toContain('<DashboardChartTooltip')
		expect(chartCard).toContain('<DashboardChartLegend')
		expect(donutChart).toContain('--vis-donut-background-color: transparent')
		expect(donutChart).toContain('--vis-donut-segment-stroke-color: transparent')
		expect(chartCard).toContain(':categories="barCategories"')
		expect(chartCard).toContain(':y-axis="barKeys"')
		expect(chartCard).toContain('hide-x-axis')
		expect(chartCard).toContain('hide-y-axis')
		expect(panel).toContain('<DashboardDriverInputsCard')
		expect(driverInputs).toContain('<DashboardDonutChart')
		expect(model).toContain('driverInputs: {')
		expect(model).not.toContain("key: 'steering'")
		expect(chartTooltip).toContain('entry.formattedValue')
		expect(chartLegend).toContain('formatPercentage(entry.value)')
		expect(model).toContain('dashboard.totals.units.metres')
		expect(model).toContain('dashboard.totals.units.seconds')
		expect(model).toContain('maximumFractionDigits: 2')
	})
})
