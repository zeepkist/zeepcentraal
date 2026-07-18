<template>
	<section class="overflow-hidden rounded-2xl border border-border bg-card/60">
		<header class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 p-4">
			<div>
				<h3 class="font-bold text-highlighted">{{ labels.title }}</h3>
				<p class="mt-1 text-xs text-muted-foreground">{{ labels.description }}</p>
			</div>
			<TablerIcon :name="labels.icon" class="size-5 shrink-0 text-primary" />
		</header>

		<div v-if="runs.length > 0" class="divide-y divide-border/70">
			<article
				v-for="run in runs"
				:key="run.recordId"
				class="p-4"
				:class="run.isPrimary ? 'bg-primary/5' : undefined"
			>
				<header class="flex flex-wrap items-center gap-2">
					<span class="size-2.5 rounded-full" :style="{ backgroundColor: run.color }" />
					<h4 class="min-w-0 flex-1 truncate text-sm font-bold text-highlighted">
						{{ run.label }}
					</h4>
					<UBadge v-if="run.isPrimary" color="primary" variant="soft" size="xs">
						{{ labels.primary }}
					</UBadge>
				</header>

				<dl v-if="run.available" class="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
					<div>
						<dt class="text-xs font-medium text-muted-foreground">
							{{ labels.labels.airborneDuration }}
						</dt>
						<dd class="mt-1 text-lg font-black tabular-nums text-highlighted">
							{{ formatDuration(run.airborneDuration) }}
						</dd>
					</div>

					<div>
						<dt class="flex items-center gap-1.5 text-xs font-bold text-highlighted">
							<TablerIcon :name="labels.controls.braking.icon" class="size-4 text-primary" />
							{{ labels.controls.braking.title }}
							<UTooltip :text="labels.controls.braking.description">
								<TablerIcon
									name="info-circle"
									class="size-3.5 text-muted-foreground"
									:aria-label="labels.controls.braking.description"
								/>
							</UTooltip>
						</dt>
						<dd class="mt-1 text-sm font-semibold tabular-nums text-highlighted">
							{{ formatEventSummary(run.braking) }}
						</dd>
						<dd class="mt-1 text-xs leading-5 text-muted-foreground">
							{{ labels.labels.angularVelocityReduction }}
							<span class="font-medium tabular-nums text-toned">
								{{ formatMetric(run.medianBrakeAngularVelocityReduction, labels.units.radiansPerSecond) }}
							</span>
							<br />
							{{ labels.labels.uprightImprovement }}
							<span class="font-medium tabular-nums text-toned">
								{{ formatAngle(run.medianBrakeUprightImprovement) }}
							</span>
						</dd>
					</div>

					<div>
						<dt class="flex items-center gap-1.5 text-xs font-bold text-highlighted">
							<TablerIcon :name="labels.controls.armsUp.icon" class="size-4 text-primary" />
							{{ labels.controls.armsUp.title }}
							<UTooltip :text="labels.controls.armsUp.description">
								<TablerIcon
									name="info-circle"
									class="size-3.5 text-muted-foreground"
									:aria-label="labels.controls.armsUp.description"
								/>
							</UTooltip>
						</dt>
						<dd class="mt-1 text-sm font-semibold tabular-nums text-highlighted">
							{{ formatEventSummary(run.armsUp) }}
						</dd>
						<dd class="mt-1 text-xs leading-5 text-muted-foreground">
							{{ labels.labels.verticalTravel }}
							<span class="font-medium tabular-nums text-toned">
								{{ formatMetric(run.medianArmsUpVerticalTravel, labels.units.metres) }}
							</span>
							<br />
							{{ labels.labels.uprightImprovement }}
							<span class="font-medium tabular-nums text-toned">
								{{ formatAngle(run.medianArmsUpUprightImprovement) }}
							</span>
						</dd>
					</div>

					<div>
						<dt class="flex items-center gap-1.5 text-xs font-bold text-highlighted">
							<TablerIcon name="steering-wheel" class="size-4 text-primary" />
							{{ labels.labels.airSteering }}
						</dt>
						<dd class="mt-1 space-y-1 text-xs leading-5 text-muted-foreground">
							<div>
								<span class="font-medium text-toned">{{ labels.labels.left }}</span>
								· {{ formatEventSummary(run.steeringLeft) }}<br />
								{{ labels.labels.rotation }}
								<span class="tabular-nums text-toned">{{ formatAngle(run.medianSteeringLeftRotation) }}</span>
								· {{ labels.labels.rotationRate }}
								<span class="tabular-nums text-toned">{{ formatAngularRate(run.medianSteeringLeftRotationRate) }}</span>
							</div>
							<div>
								<span class="font-medium text-toned">{{ labels.labels.right }}</span>
								· {{ formatEventSummary(run.steeringRight) }}<br />
								{{ labels.labels.rotation }}
								<span class="tabular-nums text-toned">{{ formatAngle(run.medianSteeringRightRotation) }}</span>
								· {{ labels.labels.rotationRate }}
								<span class="tabular-nums text-toned">{{ formatAngularRate(run.medianSteeringRightRotationRate) }}</span>
							</div>
						</dd>
					</div>
				</dl>

				<p v-else class="mt-3 text-sm text-muted-foreground">{{ labels.unavailableLabel }}</p>
			</article>

			<p class="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
				{{ labels.observedLabel }}
			</p>
		</div>

		<div v-else class="grid min-h-32 place-items-center px-6 text-sm text-muted-foreground">
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

function formatEventSummary(summary: RecordAirControlEventSummary) {
	const share =
		summary.airborneShare === null
			? props.labels.unavailableLabel
			: percentageFormat.value.format(summary.airborneShare)
	return `${props.labels.labels.events} ${integerFormat.value.format(summary.eventCount)} · ${props.labels.labels.airborneShare} ${share}`
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
