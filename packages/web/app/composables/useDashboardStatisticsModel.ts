import type { Ref } from 'vue'
import type {
	Zc_DashboardStatisticsQuery,
	Zc_DashboardV6StatisticAggregatesFragment,
} from '~/graphql/generated/graphql'
import type {
	DashboardChartEntry,
	DashboardStatisticsMetric,
	DashboardStatisticsModel,
} from '~/types/app'

export function useDashboardStatisticsModel(
	statistics: Ref<Zc_DashboardStatisticsQuery | undefined>,
	currentMonth: Ref<string>,
) {
	const { t, locale } = useI18n()
	const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
	const oneDecimal = computed(
		() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
	)
	const twoDecimals = computed(
		() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }),
	)

	type StatisticAggregates = Zc_DashboardV6StatisticAggregatesFragment
	type StatisticSum = NonNullable<StatisticAggregates['sum']>

	const surfaceColors = {
		tarmac: '#64748b',
		grass: '#22c55e',
		sand: '#f59e0b',
		ice: '#38bdf8',
		metal: '#94a3b8',
		snow: '#e2e8f0',
		soap: '#ec4899',
	} as const

	const numeric = (value: unknown) => Number(value ?? 0)
	const formatDistance = (metres: number) =>
		Math.abs(metres) < 1000
			? `${twoDecimals.value.format(metres)} ${t('dashboard.totals.units.metres')}`
			: `${twoDecimals.value.format(metres / 1000)} ${t('dashboard.totals.units.kilometres')}`
	const formatDuration = (seconds: number) =>
		seconds >= 3600
			? `${twoDecimals.value.format(seconds / 3600)} ${t('dashboard.totals.units.hours')}`
			: seconds >= 60
				? `${twoDecimals.value.format(seconds / 60)} ${t('dashboard.totals.units.minutes')}`
				: `${twoDecimals.value.format(seconds)} ${t('dashboard.totals.units.seconds')}`
	const formatCount = (value: number) => numberFormat.value.format(value)
	const totalEntries = (entries: DashboardChartEntry[]) =>
		entries.reduce((total, entry) => total + entry.value, 0)
	const chartEntry = (
		key: string,
		label: string,
		value: number,
		color: string,
		formattedValue: string,
	): DashboardChartEntry => ({ key, label, value, color, formattedValue })

	function surfaceDistanceEntries(sum?: StatisticSum | null): DashboardChartEntry[] {
		return [
			chartEntry(
				'tarmac',
				t('dashboard.totals.surfaces.tarmac'),
				numeric(sum?.distanceOnTarmac),
				surfaceColors.tarmac,
				formatDistance(numeric(sum?.distanceOnTarmac)),
			),
			chartEntry(
				'grass',
				t('dashboard.totals.surfaces.grass'),
				numeric(sum?.distanceOnGrass),
				surfaceColors.grass,
				formatDistance(numeric(sum?.distanceOnGrass)),
			),
			chartEntry(
				'sand',
				t('dashboard.totals.surfaces.sand'),
				numeric(sum?.distanceOnSand),
				surfaceColors.sand,
				formatDistance(numeric(sum?.distanceOnSand)),
			),
			chartEntry(
				'ice',
				t('dashboard.totals.surfaces.ice'),
				numeric(sum?.distanceOnIce),
				surfaceColors.ice,
				formatDistance(numeric(sum?.distanceOnIce)),
			),
			chartEntry(
				'metal',
				t('dashboard.totals.surfaces.metal'),
				numeric(sum?.distanceOnMetal),
				surfaceColors.metal,
				formatDistance(numeric(sum?.distanceOnMetal)),
			),
			chartEntry(
				'snow',
				t('dashboard.totals.surfaces.snow'),
				numeric(sum?.distanceOnSnow),
				surfaceColors.snow,
				formatDistance(numeric(sum?.distanceOnSnow)),
			),
			chartEntry(
				'soap',
				t('dashboard.totals.surfaces.soap'),
				numeric(sum?.distanceOnSoap),
				surfaceColors.soap,
				formatDistance(numeric(sum?.distanceOnSoap)),
			),
		]
	}

	function surfaceTimeEntries(sum?: StatisticSum | null): DashboardChartEntry[] {
		return [
			chartEntry(
				'tarmac',
				t('dashboard.totals.surfaces.tarmac'),
				numeric(sum?.timeOnTarmac),
				surfaceColors.tarmac,
				formatDuration(numeric(sum?.timeOnTarmac)),
			),
			chartEntry(
				'grass',
				t('dashboard.totals.surfaces.grass'),
				numeric(sum?.timeOnGrass),
				surfaceColors.grass,
				formatDuration(numeric(sum?.timeOnGrass)),
			),
			chartEntry(
				'sand',
				t('dashboard.totals.surfaces.sand'),
				numeric(sum?.timeOnSand),
				surfaceColors.sand,
				formatDuration(numeric(sum?.timeOnSand)),
			),
			chartEntry(
				'ice',
				t('dashboard.totals.surfaces.ice'),
				numeric(sum?.timeOnIce),
				surfaceColors.ice,
				formatDuration(numeric(sum?.timeOnIce)),
			),
			chartEntry(
				'metal',
				t('dashboard.totals.surfaces.metal'),
				numeric(sum?.timeOnMetal),
				surfaceColors.metal,
				formatDuration(numeric(sum?.timeOnMetal)),
			),
			chartEntry(
				'snow',
				t('dashboard.totals.surfaces.snow'),
				numeric(sum?.timeOnSnow),
				surfaceColors.snow,
				formatDuration(numeric(sum?.timeOnSnow)),
			),
			chartEntry(
				'soap',
				t('dashboard.totals.surfaces.soap'),
				numeric(sum?.timeOnSoap),
				surfaceColors.soap,
				formatDuration(numeric(sum?.timeOnSoap)),
			),
		]
	}

	function movementDistanceEntries(sum?: StatisticSum | null): DashboardChartEntry[] {
		return [
			chartEntry(
				'ground',
				t('dashboard.totals.movement.ground'),
				numeric(sum?.distanceOnGround),
				'#facc15',
				formatDistance(numeric(sum?.distanceOnGround)),
			),
			chartEntry(
				'air',
				t('dashboard.totals.movement.air'),
				numeric(sum?.distanceInAir),
				'#38bdf8',
				formatDistance(numeric(sum?.distanceInAir)),
			),
			chartEntry(
				'ragdoll',
				t('dashboard.totals.movement.ragdoll'),
				numeric(sum?.distanceRagdoll),
				'#f43f5e',
				formatDistance(numeric(sum?.distanceRagdoll)),
			),
		]
	}

	function movementTimeEntries(sum?: StatisticSum | null): DashboardChartEntry[] {
		return [
			chartEntry(
				'ground',
				t('dashboard.totals.movement.ground'),
				numeric(sum?.timeOnGround),
				'#facc15',
				formatDuration(numeric(sum?.timeOnGround)),
			),
			chartEntry(
				'air',
				t('dashboard.totals.movement.air'),
				numeric(sum?.timeInAir),
				'#38bdf8',
				formatDuration(numeric(sum?.timeInAir)),
			),
			chartEntry(
				'ragdoll',
				t('dashboard.totals.movement.ragdoll'),
				numeric(sum?.timeRagdoll),
				'#f43f5e',
				formatDuration(numeric(sum?.timeRagdoll)),
			),
		]
	}

	function wheelEntries(sum?: StatisticSum | null): DashboardChartEntry[] {
		const values = [
			numeric(sum?.distanceOn4Wheels),
			numeric(sum?.distanceOn3Wheels),
			numeric(sum?.distanceOn2Wheels),
			numeric(sum?.distanceOn1Wheel),
		]
		const noWheels = Math.max(
			numeric(sum?.distance) - values.reduce((total, value) => total + value, 0),
			0,
		)
		return [
			chartEntry(
				'four',
				t('dashboard.totals.wheels.four'),
				values[0] ?? 0,
				'#facc15',
				formatDistance(values[0] ?? 0),
			),
			chartEntry(
				'three',
				t('dashboard.totals.wheels.three'),
				values[1] ?? 0,
				'#a3e635',
				formatDistance(values[1] ?? 0),
			),
			chartEntry(
				'two',
				t('dashboard.totals.wheels.two'),
				values[2] ?? 0,
				'#22c55e',
				formatDistance(values[2] ?? 0),
			),
			chartEntry(
				'one',
				t('dashboard.totals.wheels.one'),
				values[3] ?? 0,
				'#38bdf8',
				formatDistance(values[3] ?? 0),
			),
			chartEntry(
				'zero',
				t('dashboard.totals.wheels.zero'),
				noWheels,
				'#f43f5e',
				formatDistance(noWheels),
			),
		]
	}

	function steeringEntries(sum?: StatisticSum | null): DashboardChartEntry[] {
		const left = numeric(sum?.turnLeftCount)
		const right = numeric(sum?.turnRightCount)
		return [
			chartEntry(
				'left',
				t('dashboard.totals.steering.left'),
				left,
				'#facc15',
				formatCount(left),
			),
			chartEntry(
				'right',
				t('dashboard.totals.steering.right'),
				right,
				'#38bdf8',
				formatCount(right),
			),
		]
	}

	function actionMetrics(sum?: StatisticSum | null): DashboardStatisticsMetric[] {
		return [
			{
				key: 'arms',
				label: t('dashboard.totals.actions.arms'),
				value: formatCount(numeric(sum?.armsUpCount)),
				icon: 'hand-stop',
			},
			{
				key: 'brakes',
				label: t('dashboard.totals.actions.brakes'),
				value: formatCount(numeric(sum?.brakeCount)),
				icon: 'brake',
			},
			{
				key: 'horns',
				label: t('dashboard.totals.actions.horns'),
				value: formatCount(numeric(sum?.hornCount)),
				icon: 'volume',
			},
		]
	}

	const statisticsModel = computed<DashboardStatisticsModel>(() => {
		const data = statistics.value
		const allTime = data?.allTimeStatistics?.aggregates?.sum
		const day = data?.dayStatistics?.aggregates?.sum
		const month = data?.monthStatistics?.aggregates?.sum
		const v6Day = data?.v6DayStatistics?.aggregates
		const v6Month = data?.v6MonthStatistics?.aggregates
		const periodData = <T>(today: T, monthValue: T) => ({ today, month: monthValue })

		const surfaceDistanceData = periodData(
			surfaceDistanceEntries(v6Day?.sum),
			surfaceDistanceEntries(v6Month?.sum),
		)
		const surfaceTimeData = periodData(
			surfaceTimeEntries(v6Day?.sum),
			surfaceTimeEntries(v6Month?.sum),
		)
		const movementDistanceData = periodData(
			movementDistanceEntries(v6Day?.sum),
			movementDistanceEntries(v6Month?.sum),
		)
		const movementTimeData = periodData(
			movementTimeEntries(v6Day?.sum),
			movementTimeEntries(v6Month?.sum),
		)
		const wheelData = periodData(wheelEntries(v6Day?.sum), wheelEntries(v6Month?.sum))
		const steeringData = periodData(steeringEntries(v6Day?.sum), steeringEntries(v6Month?.sum))
		const chartTotal = (
			data: { today: DashboardChartEntry[]; month: DashboardChartEntry[] },
			formatter: (value: number) => string,
		) => periodData(formatter(totalEntries(data.today)), formatter(totalEntries(data.month)))

		return {
			distanceMetrics: [
				{
					key: 'total',
					label: t('dashboard.totals.distance.total'),
					value: formatDistance(numeric(allTime?.distance)),
					icon: 'route',
				},
				{
					key: 'today',
					label: t('dashboard.totals.distance.today'),
					value: formatDistance(numeric(day?.distance)),
					icon: 'clock-24',
				},
				{
					key: 'month',
					label: t('dashboard.totals.distance.month', { month: currentMonth.value }),
					value: formatDistance(numeric(month?.distance)),
					icon: 'calendar-stats',
				},
			],
			periodSelectorLabel: t('dashboard.totals.period.title'),
			periodDescription: t('dashboard.totals.period.description'),
			minimumVersionLabel: t('dashboard.totals.period.minimumVersion'),
			todayLabel: t('dashboard.totals.period.today'),
			monthLabel: currentMonth.value,
			emptyLabel: t('dashboard.totals.empty'),
			charts: [
				{
					key: 'surface-distance',
					title: t('dashboard.totals.surfaceDistance.title'),
					description: t('dashboard.totals.surfaceDistance.description'),
					icon: 'road',
					kind: 'donut',
					data: surfaceDistanceData,
					total: chartTotal(surfaceDistanceData, formatDistance),
				},
				{
					key: 'surface-time',
					title: t('dashboard.totals.surfaceTime.title'),
					description: t('dashboard.totals.surfaceTime.description'),
					icon: 'hourglass',
					kind: 'donut',
					data: surfaceTimeData,
					total: chartTotal(surfaceTimeData, formatDuration),
				},
				{
					key: 'movement-distance',
					title: t('dashboard.totals.movementDistance.title'),
					description: t('dashboard.totals.movementDistance.description'),
					icon: 'wind',
					kind: 'bar',
					data: movementDistanceData,
					total: chartTotal(movementDistanceData, formatDistance),
				},
				{
					key: 'movement-time',
					title: t('dashboard.totals.movementTime.title'),
					description: t('dashboard.totals.movementTime.description'),
					icon: 'clock',
					kind: 'bar',
					data: movementTimeData,
					total: chartTotal(movementTimeData, formatDuration),
				},
				{
					key: 'wheels',
					title: t('dashboard.totals.wheelDistance.title'),
					description: t('dashboard.totals.wheelDistance.description'),
					icon: 'steering-wheel',
					kind: 'bar',
					data: wheelData,
					total: chartTotal(wheelData, formatDistance),
				},
				{
					key: 'steering',
					title: t('dashboard.totals.steering.title'),
					description: t('dashboard.totals.steering.description'),
					icon: 'arrows-left-right',
					kind: 'donut',
					half: true,
					data: steeringData,
					total: chartTotal(steeringData, formatCount),
				},
			],
			averageSpeed: {
				title: t('dashboard.totals.averageSpeed.title'),
				description: t('dashboard.totals.averageSpeed.description'),
				data: periodData(
					`${oneDecimal.value.format(numeric(v6Day?.average?.averageSpeed))} ${t('dashboard.totals.units.kilometresPerHour')}`,
					`${oneDecimal.value.format(numeric(v6Month?.average?.averageSpeed))} ${t('dashboard.totals.units.kilometresPerHour')}`,
				),
			},
			actions: {
				title: t('dashboard.totals.actions.title'),
				description: t('dashboard.totals.actions.description'),
				data: periodData(actionMetrics(v6Day?.sum), actionMetrics(v6Month?.sum)),
			},
		}
	})

	return statisticsModel
}
