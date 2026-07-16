import type { Ref } from 'vue'
import type { Zc_LevelStatisticsQuery } from '~/graphql/generated/graphql'
import type {
	DashboardChartEntry,
	DashboardStatisticsMetric,
	RecordTelemetryModel,
} from '~/types/app'

export function useRecordTelemetryModel(
	statistics: Ref<Zc_LevelStatisticsQuery | undefined>,
	scope: 'level' | 'user' = 'level',
) {
	const { locale, t } = useI18n()
	const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
	const oneDecimal = computed(
		() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
	)
	const twoDecimals = computed(
		() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }),
	)
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
	const entry = (
		key: string,
		label: string,
		value: number,
		color: string,
		formattedValue: string,
	): DashboardChartEntry => ({ key, label, value, color, formattedValue })
	const total = (entries: DashboardChartEntry[]) =>
		entries.reduce((result, item) => result + item.value, 0)

	const surfaceColors = {
		tarmac: '#64748b',
		grass: '#22c55e',
		sand: '#f59e0b',
		ice: '#38bdf8',
		metal: '#94a3b8',
		snow: '#e2e8f0',
		soap: '#ec4899',
	} as const

	const scopeT = (key: string) =>
		t(`${scope === 'user' ? 'users.profile.telemetry' : 'levels.detail.stats'}.${key}`)

	return computed<RecordTelemetryModel>(() => {
		const data = statistics.value
		const all = data?.allStatistics
		const aggregates = data?.v6Statistics?.aggregates
		const sum = aggregates?.sum
		const average = aggregates?.average
		const max = aggregates?.max
		const surfaceDistance = [
			entry(
				'tarmac',
				t('dashboard.totals.surfaces.tarmac'),
				numeric(sum?.distanceOnTarmac),
				surfaceColors.tarmac,
				formatDistance(numeric(sum?.distanceOnTarmac)),
			),
			entry(
				'grass',
				t('dashboard.totals.surfaces.grass'),
				numeric(sum?.distanceOnGrass),
				surfaceColors.grass,
				formatDistance(numeric(sum?.distanceOnGrass)),
			),
			entry(
				'sand',
				t('dashboard.totals.surfaces.sand'),
				numeric(sum?.distanceOnSand),
				surfaceColors.sand,
				formatDistance(numeric(sum?.distanceOnSand)),
			),
			entry(
				'ice',
				t('dashboard.totals.surfaces.ice'),
				numeric(sum?.distanceOnIce),
				surfaceColors.ice,
				formatDistance(numeric(sum?.distanceOnIce)),
			),
			entry(
				'metal',
				t('dashboard.totals.surfaces.metal'),
				numeric(sum?.distanceOnMetal),
				surfaceColors.metal,
				formatDistance(numeric(sum?.distanceOnMetal)),
			),
			entry(
				'snow',
				t('dashboard.totals.surfaces.snow'),
				numeric(sum?.distanceOnSnow),
				surfaceColors.snow,
				formatDistance(numeric(sum?.distanceOnSnow)),
			),
			entry(
				'soap',
				t('dashboard.totals.surfaces.soap'),
				numeric(sum?.distanceOnSoap),
				surfaceColors.soap,
				formatDistance(numeric(sum?.distanceOnSoap)),
			),
		]
		const surfaceTime = [
			entry(
				'tarmac',
				t('dashboard.totals.surfaces.tarmac'),
				numeric(sum?.timeOnTarmac),
				surfaceColors.tarmac,
				formatDuration(numeric(sum?.timeOnTarmac)),
			),
			entry(
				'grass',
				t('dashboard.totals.surfaces.grass'),
				numeric(sum?.timeOnGrass),
				surfaceColors.grass,
				formatDuration(numeric(sum?.timeOnGrass)),
			),
			entry(
				'sand',
				t('dashboard.totals.surfaces.sand'),
				numeric(sum?.timeOnSand),
				surfaceColors.sand,
				formatDuration(numeric(sum?.timeOnSand)),
			),
			entry(
				'ice',
				t('dashboard.totals.surfaces.ice'),
				numeric(sum?.timeOnIce),
				surfaceColors.ice,
				formatDuration(numeric(sum?.timeOnIce)),
			),
			entry(
				'metal',
				t('dashboard.totals.surfaces.metal'),
				numeric(sum?.timeOnMetal),
				surfaceColors.metal,
				formatDuration(numeric(sum?.timeOnMetal)),
			),
			entry(
				'snow',
				t('dashboard.totals.surfaces.snow'),
				numeric(sum?.timeOnSnow),
				surfaceColors.snow,
				formatDuration(numeric(sum?.timeOnSnow)),
			),
			entry(
				'soap',
				t('dashboard.totals.surfaces.soap'),
				numeric(sum?.timeOnSoap),
				surfaceColors.soap,
				formatDuration(numeric(sum?.timeOnSoap)),
			),
		]
		const movementDistance = [
			entry(
				'ground',
				t('dashboard.totals.movement.ground'),
				numeric(sum?.distanceOnGround),
				'#facc15',
				formatDistance(numeric(sum?.distanceOnGround)),
			),
			entry(
				'air',
				t('dashboard.totals.movement.air'),
				numeric(sum?.distanceInAir),
				'#38bdf8',
				formatDistance(numeric(sum?.distanceInAir)),
			),
			entry(
				'ragdoll',
				t('dashboard.totals.movement.ragdoll'),
				numeric(sum?.distanceRagdoll),
				'#f43f5e',
				formatDistance(numeric(sum?.distanceRagdoll)),
			),
		]
		const movementTime = [
			entry(
				'ground',
				t('dashboard.totals.movement.ground'),
				numeric(sum?.timeOnGround),
				'#facc15',
				formatDuration(numeric(sum?.timeOnGround)),
			),
			entry(
				'air',
				t('dashboard.totals.movement.air'),
				numeric(sum?.timeInAir),
				'#38bdf8',
				formatDuration(numeric(sum?.timeInAir)),
			),
			entry(
				'ragdoll',
				t('dashboard.totals.movement.ragdoll'),
				numeric(sum?.timeRagdoll),
				'#f43f5e',
				formatDuration(numeric(sum?.timeRagdoll)),
			),
		]
		const wheelValues = [
			numeric(sum?.distanceOn4Wheels),
			numeric(sum?.distanceOn3Wheels),
			numeric(sum?.distanceOn2Wheels),
			numeric(sum?.distanceOn1Wheel),
		]
		const noWheels = Math.max(
			numeric(sum?.distance) - wheelValues.reduce((result, value) => result + value, 0),
			0,
		)
		const wheels = [
			entry(
				'four',
				t('dashboard.totals.wheels.four'),
				wheelValues[0] ?? 0,
				'#facc15',
				formatDistance(wheelValues[0] ?? 0),
			),
			entry(
				'three',
				t('dashboard.totals.wheels.three'),
				wheelValues[1] ?? 0,
				'#a3e635',
				formatDistance(wheelValues[1] ?? 0),
			),
			entry(
				'two',
				t('dashboard.totals.wheels.two'),
				wheelValues[2] ?? 0,
				'#22c55e',
				formatDistance(wheelValues[2] ?? 0),
			),
			entry(
				'one',
				t('dashboard.totals.wheels.one'),
				wheelValues[3] ?? 0,
				'#38bdf8',
				formatDistance(wheelValues[3] ?? 0),
			),
			entry(
				'zero',
				t('dashboard.totals.wheels.zero'),
				noWheels,
				'#f43f5e',
				formatDistance(noWheels),
			),
		]
		const steering = [
			entry(
				'left',
				t('dashboard.totals.steering.left'),
				numeric(sum?.turnLeftCount),
				'#facc15',
				formatCount(numeric(sum?.turnLeftCount)),
			),
			entry(
				'right',
				t('dashboard.totals.steering.right'),
				numeric(sum?.turnRightCount),
				'#38bdf8',
				formatCount(numeric(sum?.turnRightCount)),
			),
		]
		const chart = (
			key: string,
			title: string,
			description: string,
			icon: string,
			entries: DashboardChartEntry[],
			formatter: (value: number) => string,
		) => ({ key, title, description, icon, entries, totalLabel: formatter(total(entries)) })
		const actions: DashboardStatisticsMetric[] = [
			{
				key: 'arms',
				label: t('dashboard.totals.actions.arms'),
				value: formatCount(numeric(sum?.armsUpCount)),
				icon: 'arrow-down-from-arc',
			},
			{
				key: 'brakes',
				label: t('dashboard.totals.actions.brakes'),
				value: formatCount(numeric(sum?.brakeCount)),
				icon: 'hand-stop',
			},
			{
				key: 'horns',
				label: t('dashboard.totals.actions.horns'),
				value: formatCount(numeric(sum?.hornCount)),
				icon: 'volume',
			},
		]

		return {
			minimumVersionLabel: t('dashboard.totals.period.minimumVersion'),
			emptyLabel: scopeT('empty'),
			overviewMetrics: [
				{
					key: 'distance',
					label: scopeT('totalDistance'),
					value: formatDistance(numeric(all?.aggregates?.sum?.distance)),
					icon: 'route',
				},
				{
					key: 'runs',
					label: scopeT('submittedRuns'),
					value: formatCount(numeric(all?.totalCount)),
					icon: 'flag-3',
				},
				{
					key: 'telemetry-runs',
					label: scopeT('telemetryRuns'),
					value: formatCount(numeric(data?.v6Statistics?.totalCount)),
					icon: 'ghost-2',
				},
				{
					key: 'time',
					label: scopeT('totalTime'),
					value: formatDuration(numeric(sum?.time)),
					icon: 'clock',
				},
				{
					key: 'average-speed',
					label: t('dashboard.totals.averageSpeed.title'),
					value: `${oneDecimal.value.format(numeric(average?.averageSpeed))} ${t('dashboard.totals.units.kilometresPerHour')}`,
					icon: 'gauge',
				},
				{
					key: 'max-speed',
					label: scopeT('maxSpeed'),
					value: `${oneDecimal.value.format(numeric(max?.maxSpeed))} ${t('dashboard.totals.units.kilometresPerHour')}`,
					icon: 'gauge',
				},
				{
					key: 'average-g',
					label: t('dashboard.totals.averageGforce.title'),
					value: `${twoDecimals.value.format(numeric(average?.averageGforce))} ${t('dashboard.totals.units.g')}`,
					icon: 'arrow-narrow-down-dashed',
				},
				{
					key: 'max-g',
					label: scopeT('maxGforce'),
					value: `${twoDecimals.value.format(numeric(max?.maxGforce))} ${t('dashboard.totals.units.g')}`,
					icon: 'arrow-narrow-down-dashed',
				},
			],
			charts: [
				chart(
					'surface-distance',
					t('dashboard.totals.surfaceDistance.title'),
					scopeT('surfaceDistance'),
					'road',
					surfaceDistance,
					formatDistance,
				),
				chart(
					'surface-time',
					t('dashboard.totals.surfaceTime.title'),
					scopeT('surfaceTime'),
					'hourglass',
					surfaceTime,
					formatDuration,
				),
				chart(
					'movement-distance',
					t('dashboard.totals.movementDistance.title'),
					scopeT('movementDistance'),
					'wind',
					movementDistance,
					formatDistance,
				),
				chart(
					'movement-time',
					t('dashboard.totals.movementTime.title'),
					scopeT('movementTime'),
					'clock',
					movementTime,
					formatDuration,
				),
				chart(
					'wheels',
					t('dashboard.totals.wheelDistance.title'),
					scopeT('wheelDistance'),
					'wheel',
					wheels,
					formatDistance,
				),
			],
			driverInputs: {
				title: t('dashboard.totals.actions.title'),
				description: scopeT('driverInputs'),
				icon: 'steering-wheel',
				steering,
				steeringTotalLabel: formatCount(total(steering)),
				actions,
			},
		}
	})
}

export const useLevelTelemetryModel = useRecordTelemetryModel
