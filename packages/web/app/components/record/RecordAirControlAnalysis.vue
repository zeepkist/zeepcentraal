<template>
	<section class="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card to-primary/5">
		<header class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 p-4">
			<div>
				<h3 class="font-bold text-highlighted">{{ labels.title }}</h3>
				<p class="mt-1 text-xs text-muted-foreground">{{ labels.description }}</p>
			</div>
			<span class="rounded-lg bg-primary/10 p-1.5 text-primary">
				<TablerIcon :name="labels.icon" class="size-4" />
			</span>
		</header>

		<div v-if="runs.length > 0" class="space-y-3 p-4">
			<article
				v-for="run in runs"
				:key="run.recordId"
				class="rounded-xl border p-3"
				:class="run.isPrimary ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-card/55'"
			>
				<header class="flex flex-wrap items-center gap-2">
					<span class="size-2.5 rounded-full" :style="{ backgroundColor: run.color }" />
					<h4 class="min-w-0 flex-1 truncate text-sm font-bold text-highlighted">
						{{ run.label }}
					</h4>
					<UBadge v-if="run.isPrimary" color="primary" variant="soft" size="xs">
						{{ labels.primary }}
					</UBadge>
					<div v-if="run.available" class="text-xs tabular-nums text-muted-foreground">
						{{ labels.labels.airborneDuration }}
						<span class="ml-1 font-semibold text-highlighted">
							{{ formatDuration(run.airborneDuration) }}
						</span>
					</div>
				</header>

				<div v-if="run.available" class="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
					<div
						v-for="control in controlsFor(run)"
						:key="control.key"
						class="rounded-lg border border-border/60 bg-muted/20 p-3"
					>
						<div class="flex items-start gap-2">
							<TablerIcon :name="control.icon" class="mt-0.5 size-4 shrink-0 text-primary" />
							<div class="min-w-0">
								<h5 class="text-xs font-bold text-highlighted">{{ control.title }}</h5>
								<p class="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
									{{ control.description }}
								</p>
							</div>
						</div>

						<dl class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
							<template v-for="metric in control.metrics" :key="metric.label">
								<dt class="truncate text-muted-foreground">{{ metric.label }}</dt>
								<dd class="text-right font-semibold tabular-nums text-highlighted">
									{{ metric.value }}
								</dd>
							</template>
						</dl>
					</div>
				</div>

				<div v-else class="mt-3 rounded-lg bg-muted/25 px-3 py-4 text-center text-sm text-muted-foreground">
					{{ labels.unavailableLabel }}
				</div>
			</article>

			<p class="text-xs leading-relaxed text-muted-foreground">{{ labels.observedLabel }}</p>
		</div>

		<div v-else class="grid min-h-40 place-items-center px-6 text-sm text-muted-foreground">
			{{ labels.unavailableLabel }}
		</div>
	</section>
</template>

<script setup lang="ts">
import type { RecordAnalysisLabels } from '~/utils/recordAnalysisLabels'
import type {
	RecordAirControlEventSummary,
	RecordAirControlRun,
} from '~/utils/recordGhostAnalysis'

const props = defineProps<{
	runs: RecordAirControlRun[]
	labels: RecordAnalysisLabels['airControl']
}>()

const { locale } = useI18n()
const integerFormat = computed(() => new Intl.NumberFormat(locale.value))
const decimalFormat = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }),
)
const percentageFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }),
)

function controlsFor(run: RecordAirControlRun) {
	return [
		{
			key: 'braking',
			...props.labels.controls.braking,
			metrics: [
				...eventMetrics(run.braking),
				{
					label: props.labels.labels.angularVelocityReduction,
					value: formatMetric(
						run.medianBrakeAngularVelocityReduction,
						props.labels.units.radiansPerSecond,
					),
				},
				{
					label: props.labels.labels.uprightImprovement,
					value: formatAngle(run.medianBrakeUprightImprovement),
				},
			],
		},
		{
			key: 'arms-up',
			...props.labels.controls.armsUp,
			metrics: [
				...eventMetrics(run.armsUp),
				{
					label: props.labels.labels.verticalTravel,
					value: formatMetric(run.medianArmsUpVerticalTravel, props.labels.units.metres),
				},
				{
					label: props.labels.labels.uprightImprovement,
					value: formatAngle(run.medianArmsUpUprightImprovement),
				},
			],
		},
		{
			key: 'steering-left',
			...props.labels.controls.steeringLeft,
			metrics: [
				...eventMetrics(run.steeringLeft),
				{
					label: props.labels.labels.rotation,
					value: formatAngle(run.medianSteeringLeftRotation),
				},
				{
					label: props.labels.labels.rotationRate,
					value: formatAngularRate(run.medianSteeringLeftRotationRate),
				},
			],
		},
		{
			key: 'steering-right',
			...props.labels.controls.steeringRight,
			metrics: [
				...eventMetrics(run.steeringRight),
				{
					label: props.labels.labels.rotation,
					value: formatAngle(run.medianSteeringRightRotation),
				},
				{
					label: props.labels.labels.rotationRate,
					value: formatAngularRate(run.medianSteeringRightRotationRate),
				},
			],
		},
	]
}

function eventMetrics(summary: RecordAirControlEventSummary) {
	return [
		{
			label: props.labels.labels.events,
			value: integerFormat.value.format(summary.eventCount),
		},
		{
			label: props.labels.labels.airborneShare,
			value:
				summary.airborneShare === null
					? props.labels.unavailableLabel
					: percentageFormat.value.format(summary.airborneShare),
		},
	]
}

function formatDuration(value: number | null) {
	return formatMetric(value, props.labels.units.seconds)
}

function formatAngle(value: number | null) {
	return value === null
		? props.labels.unavailableLabel
		: `${decimalFormat.value.format((value * 180) / Math.PI)} ${props.labels.units.degrees}`
}

function formatAngularRate(value: number | null) {
	return value === null
		? props.labels.unavailableLabel
		: `${decimalFormat.value.format((value * 180) / Math.PI)} ${props.labels.units.degreesPerSecond}`
}

function formatMetric(value: number | null, unit: string) {
	return value === null
		? props.labels.unavailableLabel
		: `${decimalFormat.value.format(value)} ${unit}`
}
</script>
