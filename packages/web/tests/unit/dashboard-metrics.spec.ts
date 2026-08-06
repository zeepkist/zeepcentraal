import { readFileSync } from 'node:fs'
import { Kind, parse } from 'graphql'
import { describe, expect, it } from 'vitest'
import {
	formatDashboardMonth,
	getDashboardLevelWindows,
	getDashboardMetricWindows,
} from '../../app/utils/dashboardMetrics'

const querySource = readFileSync(
	new URL('../../../graphql/documents/web/queries/dashboard.graphql', import.meta.url),
	'utf8',
)
const subscriptionSource = readFileSync(
	new URL(
		'../../../graphql/documents/web/subscriptions/dashboardMetrics.graphql',
		import.meta.url,
	),
	'utf8',
)
const dashboardMetricCopy = (
	JSON.parse(readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8')) as {
		dashboard: { metrics: Record<string, string> }
	}
).dashboard.metrics

describe('dashboard metric windows', () => {
	it('uses an exact rolling 24-hour boundary', () => {
		const windows = getDashboardMetricWindows(new Date('2026-07-12T14:30:00.000Z'))
		expect(windows.daySince).toBe('2026-07-11T14:30:00.000Z')
	})

	it('starts winter months at London midnight', () => {
		const windows = getDashboardMetricWindows(new Date('2026-01-15T12:00:00.000Z'))
		expect(windows.monthSince).toBe('2026-01-01T00:00:00.000Z')
	})

	it('starts summer months at London midnight across the UTC date boundary', () => {
		const windows = getDashboardMetricWindows(new Date('2026-07-12T12:00:00.000Z'))
		expect(windows.monthSince).toBe('2026-06-30T23:00:00.000Z')
	})
})

describe('dashboard level activity windows', () => {
	it('uses exact rolling 7-day and 30-day boundaries', () => {
		const windows = getDashboardLevelWindows(new Date('2026-07-12T14:30:00.000Z'))
		expect(windows.weekSince).toBe('2026-07-05T14:30:00.000Z')
		expect(windows.rollingMonthSince).toBe('2026-06-12T14:30:00.000Z')
	})
})

it('formats the London metric month using the active locale', () => {
	const monthSince = '2026-05-31T23:00:00.000Z'
	expect(formatDashboardMonth(monthSince, 'en-GB')).toBe('June')
	expect(formatDashboardMonth(monthSince, 'fr-FR')).toBe('juin')
})

describe('dashboard metric GraphQL', () => {
	it('uses count-only metrics and exactly six levels for every activity window', () => {
		const document = parse(querySource)
		const metricFragment = document.definitions.find(
			(definition) =>
				definition.kind === Kind.FRAGMENT_DEFINITION &&
				definition.name.value === 'ZC_DashboardMetricCounts',
		)
		expect(metricFragment?.kind).toBe(Kind.FRAGMENT_DEFINITION)
		if (metricFragment?.kind !== Kind.FRAGMENT_DEFINITION) return

		for (const field of metricFragment.selectionSet.selections) {
			if (field.kind !== Kind.FIELD) continue
			expect(
				field.arguments?.find((argument) => argument.name.value === 'first'),
			).toMatchObject({
				value: { kind: Kind.INT, value: '0' },
			})
			expect(field.arguments?.some((argument) => argument.name.value === 'offset')).toBe(
				false,
			)
		}

		const criticalQuery = document.definitions.find(
			(definition) =>
				definition.kind === Kind.OPERATION_DEFINITION &&
				definition.name?.value === 'ZC_DashboardCritical',
		)
		expect(criticalQuery?.kind).toBe(Kind.OPERATION_DEFINITION)
		if (criticalQuery?.kind !== Kind.OPERATION_DEFINITION) return
		const trendingLevels = criticalQuery.selectionSet.selections.find(
			(selection) =>
				selection.kind === Kind.FIELD && selection.alias?.value === 'trendingLevels',
		)
		expect(trendingLevels).toMatchObject({
			kind: Kind.FIELD,
			name: { value: 'hotLevelsSince' },
		})
		if (trendingLevels?.kind !== Kind.FIELD) return
		expect(
			trendingLevels.arguments?.find((argument) => argument.name.value === 'first'),
		).toMatchObject({ value: { kind: Kind.INT, value: '6' } })
		expect(
			trendingLevels.arguments?.find((argument) => argument.name.value === 'since'),
		).toMatchObject({
			value: { kind: Kind.VARIABLE, name: { value: 'daySince' } },
		})
		expect(
			criticalQuery.selectionSet.selections.some(
				(selection) =>
					selection.kind === Kind.FIELD && selection.alias?.value === 'popularLevels',
			),
		).toBe(false)

		const hotQuery = document.definitions.find(
			(definition) =>
				definition.kind === Kind.OPERATION_DEFINITION &&
				definition.name?.value === 'ZC_DashboardHotLevels',
		)
		expect(hotQuery?.kind).toBe(Kind.OPERATION_DEFINITION)
		if (hotQuery?.kind !== Kind.OPERATION_DEFINITION) return
		const activityLevels = hotQuery.selectionSet.selections[0]
		expect(activityLevels).toMatchObject({
			kind: Kind.FIELD,
			alias: { value: 'levels' },
			name: { value: 'hotLevelsSince' },
		})
		if (activityLevels?.kind !== Kind.FIELD) return
		expect(
			activityLevels.arguments?.find((argument) => argument.name.value === 'first'),
		).toMatchObject({ value: { kind: Kind.INT, value: '6' } })
		expect(
			activityLevels.arguments?.find((argument) => argument.name.value === 'since'),
		).toMatchObject({
			value: { kind: Kind.VARIABLE, name: { value: 'since' } },
		})
		const nodes = activityLevels.selectionSet?.selections.find(
			(selection) => selection.kind === Kind.FIELD && selection.name.value === 'nodes',
		)
		if (nodes?.kind !== Kind.FIELD) return
		const periodRecords = nodes.selectionSet?.selections.find(
			(selection) =>
				selection.kind === Kind.FIELD && selection.alias?.value === 'periodRecords',
		)
		expect(periodRecords).toMatchObject({
			kind: Kind.FIELD,
			name: { value: 'records' },
		})
		if (periodRecords?.kind !== Kind.FIELD) return
		expect(
			periodRecords.arguments?.find((argument) => argument.name.value === 'first'),
		).toMatchObject({ value: { kind: Kind.INT, value: '0' } })

		const subscription = parse(subscriptionSource).definitions[0]
		expect(subscription).toMatchObject({
			kind: Kind.OPERATION_DEFINITION,
			operation: 'subscription',
		})
		if (subscription?.kind !== Kind.OPERATION_DEFINITION) return
		expect(subscription.selectionSet.selections).toHaveLength(1)
		expect(subscription.selectionSet.selections[0]).toMatchObject({
			kind: Kind.FIELD,
			name: { value: 'query' },
			selectionSet: {
				selections: [
					{
						kind: Kind.FRAGMENT_SPREAD,
						name: { value: 'ZC_DashboardMetricCounts' },
					},
				],
			},
		})
	})

	it('deduplicates active users across records, workshop levels, and Super League only', () => {
		const dayStart = querySource.indexOf('activeUsersDay: users(')
		const monthStart = querySource.indexOf('activeUsersMonth: users(')
		const dayFilter = querySource.slice(dayStart, monthStart)
		const monthFilter = querySource.slice(
			monthStart,
			querySource.indexOf('\n}\n\nquery ZC_DashboardCritical'),
		)

		for (const filter of [dayFilter, monthFilter]) {
			expect(filter).toContain('records:')
			expect(filter).toContain('levelItems:')
			expect(filter).toContain('deleted: { equalTo: false }')
			expect(filter).toContain('zslLevelResults:')
			expect(filter).toContain('eventDate:')
			expect(filter).not.toContain('votes:')
		}
	})
})

describe('dashboard metric presentation', () => {
	it('passes reusable detail and accessible value data through metric cards', () => {
		const grid = readFileSync(
			new URL('../../app/components/common/MetricGrid.vue', import.meta.url),
			'utf8',
		)
		const card = readFileSync(
			new URL('../../app/components/common/StatCard.vue', import.meta.url),
			'utf8',
		)
		expect(grid).toContain(':details="metric.details"')
		expect(grid).toContain(':value-label="metric.valueLabel"')
		expect(card).toContain('v-for="detail in details"')
		expect(card).toContain(':aria-label="valueLabel"')
	})

	it('maps ranked players, 24-hour activity, total players, and monthly activity', () => {
		const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
		expect(page).toContain('data?.rankedUsers?.totalCount')
		expect(page).toContain('data?.activeUsersDay?.totalCount')
		expect(page).toContain('data?.totalUsers?.totalCount')
		expect(page).toContain('data?.activeUsersMonth?.totalCount')
		expect(page).toContain('value: `')
		expect(page).toContain('label: currentMonth.value')
		expect(page).toContain(
			"t('dashboard.metrics.activeInMonth', { month: currentMonth.value })",
		)
		expect(page).not.toContain('dashboard.metrics.thisMonth')
		expect(page).not.toContain('dashboard.metrics.activeThisMonth')
		expect(page).toContain('dashboard.metrics.rankedAndTotalPlayers')
		expect(page).toContain('dashboard.metrics.rankedAndTotalPlayersValueLabel')
		expect(page).toContain('dashboard.metrics.activeToday')
		expect(page).toMatch(/value: `\$\{rankedPlayers\} \/ \$\{totalPlayers\}`/)
		expect(page).not.toMatch(/value: `\$\{rankedPlayers\} \(\$\{activePlayersDay\}\)`/)
		expect(dashboardMetricCopy).toMatchObject({
			rankedAndTotalPlayers: 'Ranked players / Total players',
			activeToday: 'Active today',
		})
		expect(dashboardMetricCopy).not.toHaveProperty('rankedPlayers')
		expect(dashboardMetricCopy).not.toHaveProperty('rankedPlayersValueLabel')
		expect(dashboardMetricCopy).not.toHaveProperty('totalPlayers')
	})
})
