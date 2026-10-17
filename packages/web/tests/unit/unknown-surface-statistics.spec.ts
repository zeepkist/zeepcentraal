import type {
	Zc_DashboardStatisticsQuery,
	Zc_LevelStatisticsQuery,
	Zc_RecordStatisticFragment,
} from '@zeepkist/graphql/generated'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useDashboardStatisticsModel } from '../../app/composables/useDashboardStatisticsModel'
import { useRecordTelemetryModel } from '../../app/composables/useLevelTelemetryModel'
import { useSingleRecordTelemetryModel } from '../../app/composables/useSingleRecordTelemetryModel'

beforeEach(() => {
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('useRecordTelemetryModel', useRecordTelemetryModel)
	vi.stubGlobal('useAppI18n', () => ({ locale: ref('en'), t: (key: string) => key }))
})
afterEach(() => vi.unstubAllGlobals())

const sum = { distanceOnWood: 10, timeOnWood: 2, distanceOnUnknown: 30, timeOnUnknown: 6 }

describe('Unknown surface charts', () => {
	it.each([7, 8])('includes grounded V%i gaps on record pages', (ghostVersion) => {
		const model = useSingleRecordTelemetryModel(
			ref({ ...sum, ghostVersion, hasSurfaceData: false } as Zc_RecordStatisticFragment),
		).value
		for (const [key, expected] of [
			['surface-distance', 30],
			['surface-time', 6],
		] as const) {
			const chart = model.charts.find((chart) => chart.key === key)
			expect(chart?.unavailable).toBe(false)
			expect(chart?.entries.find((entry) => entry.key === 'unknown')?.value).toBe(expected)
			expect(chart?.description).toContain('dashboard.totals.surfaces.unknownDescription')
		}
	})
	it.each(['level', 'user'] as const)('includes Unknown in %s aggregate charts', (scope) => {
		const model = useRecordTelemetryModel(
			ref({ v6Statistics: { aggregates: { sum } } } as Zc_LevelStatisticsQuery),
			scope,
		).value
		expect(
			model.charts
				.find((chart) => chart.key === 'surface-distance')
				?.entries.map((entry) => entry.value)
				.reduce((a, b) => a + b, 0),
		).toBe(40)
		expect(
			model.charts
				.find((chart) => chart.key === 'surface-time')
				?.entries.find((entry) => entry.key === 'unknown')?.value,
		).toBe(6)
	})
	it('uses persisted Unknown sums for both Dashboard periods', () => {
		const statistics = ref({
			v6DayStatistics: { aggregates: { sum } },
			v6MonthStatistics: { aggregates: { sum: { ...sum, distanceOnUnknown: 90 } } },
		} as Zc_DashboardStatisticsQuery)
		const model = useDashboardStatisticsModel(statistics, ref('October'))
		const distance = model.value.charts.find((chart) => chart.key === 'surface-distance')
		expect(distance?.data.today.find((entry) => entry.key === 'unknown')?.value).toBe(30)
		expect(distance?.data.month.find((entry) => entry.key === 'unknown')?.value).toBe(90)
		expect(distance?.data.today.reduce((value, entry) => value + entry.value, 0)).toBe(40)
		expect(
			model.value.charts
				.find((chart) => chart.key === 'surface-time')
				?.data.today.find((entry) => entry.key === 'unknown')?.value,
		).toBe(6)
	})
})
