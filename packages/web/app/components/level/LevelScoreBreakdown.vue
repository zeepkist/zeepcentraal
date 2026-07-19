<template>
	<div class="grid gap-4 xl:grid-cols-2">
		<section
			v-for="group in groups"
			:key="group.key"
			class="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm sm:p-5"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<h3 class="font-bold text-highlighted">{{ group.title }}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ group.description }}</p>
				</div>
				<span class="rounded-lg bg-primary/10 p-2 text-primary">
					<TablerIcon :name="group.icon" class="size-5" />
				</span>
			</div>

			<dl v-if="hasAvailableMetric(group.metrics)" class="mt-4 grid gap-2 sm:grid-cols-2">
				<div
					v-for="metric in group.metrics"
					:key="metric.key"
					class="rounded-xl border border-border/60 bg-default/45 px-3 py-2.5"
				>
					<dt class="text-xs font-medium text-muted-foreground">{{ metric.label }}</dt>
					<dd class="mt-1 font-bold tabular-nums text-highlighted">
						{{ formatMetric(metric) }}
					</dd>
				</div>
			</dl>
			<div
				v-else
				class="mt-4 flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border/70 bg-default/30 text-sm font-medium text-muted-foreground"
			>
				{{ labels.notAvailable }}
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { LevelScoreInsights } from '~/types/app'

type MetricKey = keyof LevelScoreInsights
type MetricFormat =
	| 'boolean'
	| 'decimal'
	| 'distance'
	| 'gforce'
	| 'integer'
	| 'percentage'
	| 'rank'
	| 'rate'
	| 'speed'

type MetricDefinition = {
	key: MetricKey
	label: string
	format: MetricFormat
}

type GroupKey = 'score' | 'evidence' | 'leaderboard' | 'driving'

const props = defineProps<{
	model: LevelScoreInsights
	labels: {
		groups: Record<GroupKey, { title: string; description: string }>
		metrics: Record<MetricKey, string>
		unavailable: string
		notAvailable: string
		included: string
		excluded: string
		units: {
			metres: string
			kilometres: string
			kilometresPerHour: string
			gforce: string
			radiansPerSecond: string
			perSecond: string
		}
	}
}>()

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }))
const integerFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const percentageFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }),
)

const metric = (key: MetricKey, format: MetricFormat): MetricDefinition => ({
	key,
	format,
	label: props.labels.metrics[key],
})

const groups = computed(() => [
	{
		key: 'score' as const,
		icon: 'chart-dots-3',
		...props.labels.groups.score,
		metrics: [
			metric('competitivenessScore', 'percentage'),
			metric('worldRecordDifficultyScore', 'percentage'),
			metric('participationScore', 'percentage'),
			metric('voteAdjustment', 'percentage'),
			metric('afkModifier', 'percentage'),
			metric('passivePlaySeverity', 'percentage'),
		],
	},
	{
		key: 'evidence' as const,
		icon: 'database-search',
		...props.labels.groups.evidence,
		metrics: [
			metric('sampleSize', 'integer'),
			metric('leaderboardConfidence', 'percentage'),
			metric('inputSampleSize', 'integer'),
			metric('inputCoverage', 'percentage'),
			metric('airSampleSize', 'integer'),
			metric('wheelSampleSize', 'integer'),
			metric('slipSampleSize', 'integer'),
			metric('ragdollSampleSize', 'integer'),
			metric('stateSampleSize', 'integer'),
			metric('surfaceSampleSize', 'integer'),
			metric('velocitySampleSize', 'integer'),
			metric('matureVoteCount', 'integer'),
		],
	},
	{
		key: 'leaderboard' as const,
		icon: 'trophy',
		...props.labels.groups.leaderboard,
		metrics: [
			metric('worldRecordMargin', 'percentage'),
			metric('top5Spread', 'percentage'),
			metric('top10Spread', 'percentage'),
			metric('top50Spread', 'percentage'),
			metric('wrChallengerCount', 'integer'),
			metric('worldRecordOptimizationScore', 'percentage'),
			metric('worldRecordExcluded', 'boolean'),
			metric('leaderboardAnomalyScore', 'percentage'),
			metric('telemetryAnomalyScore', 'percentage'),
			metric('passiveRunRatio', 'percentage'),
			metric('passiveTop10Share', 'percentage'),
			metric('bestPassiveRank', 'rank'),
			metric('bestPassiveGap', 'percentage'),
		],
	},
	{
		key: 'driving' as const,
		icon: 'steering-wheel',
		...props.labels.groups.driving,
		metrics: [
			metric('driverEngagementScore', 'percentage'),
			metric('pathConsistencyScore', 'percentage'),
			metric('speedConsistencyScore', 'percentage'),
			metric('routeConsistencyScore', 'percentage'),
			metric('surfaceDiversityScore', 'percentage'),
			metric('typicalDistance', 'distance'),
			metric('typicalAverageSpeed', 'speed'),
			metric('typicalMaxSpeed', 'speed'),
			metric('typicalAirTimeShare', 'percentage'),
			metric('typicalGroundTimeShare', 'percentage'),
			metric('typicalSlipShare', 'percentage'),
			metric('typicalRagdollShare', 'percentage'),
			metric('typicalAverageAngularVelocity', 'rate'),
			metric('typicalAverageGforce', 'gforce'),
			metric('medianSteeringShare', 'percentage'),
			metric('q25SteeringShare', 'percentage'),
			metric('lowSteeringRatio', 'percentage'),
			metric('zeroControlRatio', 'percentage'),
			metric('medianBrakeShare', 'percentage'),
			metric('medianArmsUpShare', 'percentage'),
			metric('medianControlTransitionRate', 'rate'),
		],
	},
])

function isAvailable(value: number | boolean | null | undefined) {
	return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}

function hasAvailableMetric(metrics: MetricDefinition[]) {
	return metrics.some((item) => isAvailable(props.model[item.key]))
}

function formatMetric(metric: MetricDefinition) {
	const value = props.model[metric.key]
	if (!isAvailable(value)) return props.labels.unavailable
	if (typeof value === 'boolean') return value ? props.labels.excluded : props.labels.included

	switch (metric.format) {
		case 'percentage':
			return percentageFormat.value.format(value)
		case 'integer':
			return integerFormat.value.format(value)
		case 'rank':
			return `#${integerFormat.value.format(value)}`
		case 'distance':
			return value >= 1000
				? `${numberFormat.value.format(value / 1000)} ${props.labels.units.kilometres}`
				: `${numberFormat.value.format(value)} ${props.labels.units.metres}`
		case 'speed':
			return `${numberFormat.value.format(value)} ${props.labels.units.kilometresPerHour}`
		case 'gforce':
			return `${numberFormat.value.format(value)} ${props.labels.units.gforce}`
		case 'rate':
			return `${numberFormat.value.format(value)} ${metric.key === 'typicalAverageAngularVelocity' ? props.labels.units.radiansPerSecond : props.labels.units.perSecond}`
		default:
			return numberFormat.value.format(value)
	}
}
</script>
