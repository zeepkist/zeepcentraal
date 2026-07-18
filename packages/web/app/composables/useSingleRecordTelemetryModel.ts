import type { Ref } from 'vue'
import type {
	Zc_LevelStatisticsQuery,
	Zc_RecordStatisticFragment,
} from '~/graphql/generated/graphql'

export function useSingleRecordTelemetryModel(
	statistic: Ref<Zc_RecordStatisticFragment | null | undefined>,
) {
	const aggregateShape = computed<Zc_LevelStatisticsQuery | undefined>(() => {
		const value = statistic.value
		if (!value) return undefined
		return {
			allStatistics: {
				totalCount: 1,
				aggregates: { sum: { distance: value.distance } },
			},
			v6Statistics: {
				totalCount: 1,
				aggregates: {
					sum: value,
					average: value,
					max: value,
				},
			},
		} as Zc_LevelStatisticsQuery
	})
	const baseModel = useRecordTelemetryModel(aggregateShape, 'record')
	const { t } = useI18n()
	return computed(() => {
		const value = statistic.value
		const base = baseModel.value
		if (!value) return base
		const unavailable = t('common.unavailable')
		const overviewAvailability: Record<string, boolean> = {
			distance: value.distance != null,
			runs: true,
			'telemetry-runs': true,
			time: value.time != null,
			'average-speed': value.hasVelocityData === true && value.averageSpeed != null,
			'max-speed': value.hasVelocityData === true && value.maxSpeed != null,
			'average-g': value.hasVelocityData === true && value.averageGforce != null,
			'max-g': value.hasVelocityData === true && value.maxGforce != null,
		}
		const chartAvailability: Record<string, boolean> = {
			'surface-distance': value.hasSurfaceData === true,
			'surface-time': value.hasSurfaceData === true,
			'movement-distance': value.hasAirData === true || value.hasRagdollData === true,
			'movement-time': value.hasAirData === true || value.hasRagdollData === true,
			wheels: value.hasWheelData === true,
		}
		return {
			...base,
			overviewMetrics: base.overviewMetrics.map((metric) =>
				overviewAvailability[metric.key] === false
					? { ...metric, value: unavailable }
					: metric,
			),
			charts: base.charts.map((chart) => ({
				...chart,
				unavailable: chartAvailability[chart.key] === false,
			})),
			driverInputs: {
				...base.driverInputs,
				unavailable: value.hasInputData !== true,
			},
		}
	})
}
