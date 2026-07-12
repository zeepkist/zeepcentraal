import { readFileSync } from 'node:fs'
import { Kind, parse } from 'graphql'
import { describe, expect, it } from 'vitest'
import { getDashboardMetricWindows } from '../../app/utils/dashboardMetrics'

const querySource = readFileSync(
	new URL('../../app/graphql/queries/dashboard.graphql', import.meta.url),
	'utf8',
)
const subscriptionSource = readFileSync(
	new URL('../../app/graphql/subscriptions/dashboardMetrics.graphql', import.meta.url),
	'utf8',
)

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

describe('dashboard metric GraphQL', () => {
	it('uses bounded count connections, six popular levels, and a single subscription root', () => {
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

		const query = document.definitions.find(
			(definition) =>
				definition.kind === Kind.OPERATION_DEFINITION &&
				definition.name?.value === 'ZC_DashboardCritical',
		)
		expect(query?.kind).toBe(Kind.OPERATION_DEFINITION)
		if (query?.kind !== Kind.OPERATION_DEFINITION) return
		const popularLevels = query.selectionSet.selections.find(
			(selection) =>
				selection.kind === Kind.FIELD && selection.alias?.value === 'popularLevels',
		)
		if (popularLevels?.kind !== Kind.FIELD) return
		expect(
			popularLevels.arguments?.find((argument) => argument.name.value === 'first'),
		).toMatchObject({ value: { kind: Kind.INT, value: '6' } })

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
			querySource.indexOf('\n}\n\nquery ZC_DashboardLevels'),
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
	})
})
