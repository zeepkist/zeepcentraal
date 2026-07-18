<template>
	<section class="overflow-hidden rounded-2xl border border-border bg-card/60">
		<header class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 p-4">
			<div>
				<h3 class="font-bold text-highlighted">{{ labels.title }}</h3>
				<p class="mt-1 text-xs text-muted-foreground">{{ labels.description }}</p>
			</div>
			<TablerIcon :name="labels.icon" class="size-5 shrink-0 text-primary" />
		</header>

		<div v-if="runs.length > 0">
			<div class="overflow-x-auto">
				<table class="w-full min-w-3xl table-fixed border-collapse text-left">
					<colgroup>
						<col class="w-52" />
						<col class="w-36" />
						<col class="w-44" />
						<col class="w-44" />
						<col class="w-52" />
					</colgroup>
					<thead class="border-b border-border/80 bg-muted/35">
						<tr>
							<th scope="col" class="px-4 py-3 text-xs font-bold text-muted-foreground">
								{{ labels.labels.run }}
							</th>
							<th scope="col" class="px-4 py-3 text-xs font-bold text-muted-foreground">
								{{ labels.labels.airborneDuration }}
							</th>
							<th scope="col" class="px-4 py-3 text-xs font-bold text-muted-foreground">
								<span class="inline-flex items-center gap-1.5">
									<TablerIcon :name="labels.controls.braking.icon" class="size-4 text-primary" />
									{{ labels.controls.braking.title }}
									<UTooltip :text="labels.controls.braking.description">
										<TablerIcon
											name="info-circle"
											class="size-3.5 text-muted-foreground"
											:aria-label="labels.controls.braking.description"
										/>
									</UTooltip>
								</span>
							</th>
							<th scope="col" class="px-4 py-3 text-xs font-bold text-muted-foreground">
								<span class="inline-flex items-center gap-1.5">
									<TablerIcon :name="labels.controls.armsUp.icon" class="size-4 text-primary" />
									{{ labels.controls.armsUp.title }}
									<UTooltip :text="labels.controls.armsUp.description">
										<TablerIcon
											name="info-circle"
											class="size-3.5 text-muted-foreground"
											:aria-label="labels.controls.armsUp.description"
										/>
									</UTooltip>
								</span>
							</th>
							<th scope="col" class="px-4 py-3 text-xs font-bold text-muted-foreground">
								<span class="inline-flex items-center gap-1.5">
									<TablerIcon name="steering-wheel" class="size-4 text-primary" />
									{{ labels.labels.airSteering }}
									<UTooltip :text="steeringDescription">
										<TablerIcon
											name="info-circle"
											class="size-3.5 text-muted-foreground"
											:aria-label="steeringDescription"
										/>
									</UTooltip>
								</span>
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/70">
						<tr
							v-for="run in runs"
							:key="run.recordId"
							:class="run.isPrimary ? 'bg-primary/5' : undefined"
						>
							<th scope="row" class="px-4 py-3">
								<div class="flex min-w-0 items-center gap-2">
									<span
										class="size-2.5 shrink-0 rounded-full"
										:style="{ backgroundColor: run.color }"
									/>
									<span class="min-w-0 flex-1 truncate text-sm font-bold text-highlighted">
										{{ run.label }}
									</span>
									<UBadge v-if="run.isPrimary" color="primary" variant="soft" size="xs">
										{{ labels.primary }}
									</UBadge>
								</div>
							</th>

							<template v-if="run.available">
								<td class="px-4 py-3 font-bold tabular-nums text-highlighted">
									{{ formatDuration(run.airborneDuration) }}
								</td>
								<td class="px-4 py-3">
									<p class="text-sm font-semibold tabular-nums text-highlighted">
										<span class="sr-only">{{ labels.labels.events }}</span>
										{{ formatEventCount(run.braking) }}
									</p>
									<p class="mt-0.5 text-xs tabular-nums text-muted-foreground">
										<span class="sr-only">{{ labels.labels.airborneShare }}</span>
										{{ formatAirborneShare(run.braking) }}
									</p>
								</td>
								<td class="px-4 py-3">
									<p class="text-sm font-semibold tabular-nums text-highlighted">
										<span class="sr-only">{{ labels.labels.events }}</span>
										{{ formatEventCount(run.armsUp) }}
									</p>
									<p class="mt-0.5 text-xs tabular-nums text-muted-foreground">
										<span class="sr-only">{{ labels.labels.airborneShare }}</span>
										{{ formatAirborneShare(run.armsUp) }}
									</p>
								</td>
								<td class="px-4 py-3 text-xs">
									<p class="flex items-baseline justify-between gap-3">
										<span class="font-medium text-toned">{{ labels.labels.left }}</span>
										<span class="tabular-nums text-muted-foreground">
											{{ formatCompactEventSummary(run.steeringLeft) }}
										</span>
									</p>
									<p class="mt-1 flex items-baseline justify-between gap-3">
										<span class="font-medium text-toned">{{ labels.labels.right }}</span>
										<span class="tabular-nums text-muted-foreground">
											{{ formatCompactEventSummary(run.steeringRight) }}
										</span>
									</p>
								</td>
							</template>
							<td v-else colspan="4" class="px-4 py-3 text-sm text-muted-foreground">
								{{ labels.unavailableLabel }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<UCollapsible
				v-if="availableRuns.length > 0"
				:default-open="false"
				:unmount-on-hide="false"
				class="border-t border-border/80"
			>
				<template #default="{ open }">
					<UButton
						color="neutral"
						variant="ghost"
						class="w-full justify-start rounded-none px-4 py-3 text-left hover:bg-primary/5"
					>
						<TablerIcon name="chart-dots" class="size-4 shrink-0 text-primary" />
						<span class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">
							{{ labels.detailsTitle }}
						</span>
						<TablerIcon
							name="chevron-right"
							class="size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none"
							:class="open ? 'rotate-90' : undefined"
						/>
					</UButton>
				</template>

				<template #content>
					<div class="overflow-x-auto border-t border-border/70">
						<table class="w-full min-w-4xl table-fixed border-collapse text-left">
							<colgroup>
								<col class="w-52" />
								<col class="w-52" />
								<col class="w-52" />
								<col class="w-48" />
								<col class="w-48" />
							</colgroup>
							<thead class="border-b border-border/70 bg-muted/25">
								<tr>
									<th scope="col" class="px-4 py-2.5 text-xs font-bold text-muted-foreground">
										{{ labels.labels.run }}
									</th>
									<th scope="col" class="px-4 py-2.5 text-xs font-bold text-muted-foreground">
										{{ labels.controls.braking.title }}
									</th>
									<th scope="col" class="px-4 py-2.5 text-xs font-bold text-muted-foreground">
										{{ labels.controls.armsUp.title }}
									</th>
									<th scope="col" class="px-4 py-2.5 text-xs font-bold text-muted-foreground">
										{{ labels.labels.left }}
									</th>
									<th scope="col" class="px-4 py-2.5 text-xs font-bold text-muted-foreground">
										{{ labels.labels.right }}
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border/70">
								<tr
									v-for="run in availableRuns"
									:key="run.recordId"
									:class="run.isPrimary ? 'bg-primary/5' : undefined"
								>
									<th scope="row" class="px-4 py-3 text-sm font-bold text-highlighted">
										{{ run.label }}
									</th>
									<td class="px-4 py-3 text-xs leading-5 text-muted-foreground">
										{{ labels.labels.angularVelocityReduction }}
										<span class="font-medium tabular-nums text-toned">
											{{
												formatMetric(
													run.medianBrakeAngularVelocityReduction,
													labels.units.radiansPerSecond,
												)
											}}
										</span>
										<br />
										{{ labels.labels.uprightImprovement }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatAngle(run.medianBrakeUprightImprovement) }}
										</span>
									</td>
									<td class="px-4 py-3 text-xs leading-5 text-muted-foreground">
										{{ labels.labels.verticalTravel }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatMetric(run.medianArmsUpVerticalTravel, labels.units.metres) }}
										</span>
										<br />
										{{ labels.labels.uprightImprovement }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatAngle(run.medianArmsUpUprightImprovement) }}
										</span>
									</td>
									<td class="px-4 py-3 text-xs leading-5 text-muted-foreground">
										{{ labels.labels.rotation }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatAngle(run.medianSteeringLeftRotation) }}
										</span>
										<br />
										{{ labels.labels.rotationRate }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatAngularRate(run.medianSteeringLeftRotationRate) }}
										</span>
									</td>
									<td class="px-4 py-3 text-xs leading-5 text-muted-foreground">
										{{ labels.labels.rotation }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatAngle(run.medianSteeringRightRotation) }}
										</span>
										<br />
										{{ labels.labels.rotationRate }}
										<span class="font-medium tabular-nums text-toned">
											{{ formatAngularRate(run.medianSteeringRightRotationRate) }}
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</template>
			</UCollapsible>

			<p class="border-t border-border/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
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
const availableRuns = computed(() => props.runs.filter((run) => run.available))
const steeringDescription = computed(
	() =>
		`${props.labels.controls.steeringLeft.description} ${props.labels.controls.steeringRight.description}`,
)

function formatEventCount(summary: RecordAirControlEventSummary) {
	return integerFormat.value.format(summary.eventCount)
}

function formatAirborneShare(summary: RecordAirControlEventSummary) {
	const share =
		summary.airborneShare === null
			? props.labels.unavailableLabel
			: percentageFormat.value.format(summary.airborneShare)
	return share
}

function formatCompactEventSummary(summary: RecordAirControlEventSummary) {
	const share =
		summary.airborneShare === null
			? props.labels.unavailableLabel
			: percentageFormat.value.format(summary.airborneShare)
	return `${integerFormat.value.format(summary.eventCount)} · ${share}`
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
