<template>
	<div class="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card to-primary/5">
		<div v-if="runs.some((run) => run.eventCount > 0)" class="space-y-5 p-4">
			<div class="space-y-3">
				<h4 class="text-sm font-bold text-highlighted">{{ labels.comparisonTitle }}</h4>
				<div class="px-1">
					<BarChart
						:data="comparisonData"
						:categories="comparisonCategories"
						:y-axis="runKeys"
						:y-formatter="formatRunAxis"
						:y-num-ticks="runs.length"
						:y-axis-config="runAxisConfig"
						:height="Math.max(96, runs.length * 48)"
						orientation="horizontal"
						stacked
						:duration="chartDuration"
						:radius="7"
						:bar-padding="0.28"
						:padding="{ top: 4, right: 12, bottom: 4, left: 156 }"
						:tooltip="tooltipOptions"
						hide-legend
						hide-x-axis
					>
						<template #tooltip="{ values }">
							<DashboardChartTooltip
								:entries="comparisonTooltipEntries(values)"
								:title="comparisonTooltipTitle(values)"
								:show-percentage="false"
							/>
						</template>
					</BarChart>
				</div>

				<div class="overflow-x-auto border-y border-border/70">
					<table class="w-full min-w-180 border-collapse text-sm">
						<thead class="bg-muted/45 text-xs text-muted-foreground">
							<tr>
								<th scope="col" class="px-3 py-2 text-left font-semibold">
									{{ labels.labels.run }}
								</th>
								<th scope="col" class="px-3 py-2 text-right font-semibold">
									{{ labels.labels.eventCount }}
								</th>
								<th scope="col" class="px-3 py-2 text-right font-semibold">
									{{ labels.labels.totalDuration }}
								</th>
								<th scope="col" class="px-3 py-2 text-right font-semibold">
									{{ labels.labels.totalDistance }}
								</th>
								<th scope="col" class="px-3 py-2 text-right font-semibold">
									{{ labels.labels.speedRetention }}
								</th>
								<th scope="col" class="px-3 py-2 text-right font-semibold">
									{{ labels.labels.worstRetention }}
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/70">
							<tr
								v-for="run in runs"
								:key="run.recordId"
								:class="
									run.recordId === primaryRun?.recordId
										? 'bg-primary/10 text-highlighted'
										: 'bg-card/40'
								"
							>
								<th scope="row" class="max-w-60 px-3 py-2.5 text-left font-semibold">
									<span class="flex items-center gap-2">
										<span
											class="size-2.5 shrink-0 rounded-full"
											:style="{ backgroundColor: run.color }"
										/>
										<span class="truncate">{{ run.label }}</span>
									</span>
								</th>
								<td class="px-3 py-2.5 text-right tabular-nums">
									{{ integerFormat.format(run.eventCount) }}
								</td>
								<td class="px-3 py-2.5 text-right tabular-nums">
									{{ formatDuration(run.totalDuration) }}
								</td>
								<td class="px-3 py-2.5 text-right tabular-nums">
									{{ formatDistance(run.totalDistance) }}
								</td>
								<td class="px-3 py-2.5 text-right tabular-nums">
									{{ formatPercentage(run.averageSpeedRetention) }}
								</td>
								<td class="px-3 py-2.5 text-right tabular-nums">
									{{ formatPercentage(run.worstSpeedRetention) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<div v-if="primaryRun?.events.length" class="space-y-2">
				<h4 class="text-sm font-bold text-highlighted">{{ labels.eventsTitle }}</h4>
				<div class="grid gap-2 md:grid-cols-2">
					<button
						v-for="(event, index) in primaryRun.events"
						:key="event.id"
						type="button"
						class="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						@click="emit('seek', event.start)"
					>
						<span class="grid size-8 place-items-center rounded-lg bg-primary/10 font-bold tabular-nums text-primary">
							{{ integerFormat.format(index + 1) }}
						</span>
						<span class="min-w-0">
							<span class="block text-sm font-semibold text-highlighted">
								{{ formatElapsed(event.start) }} – {{ formatElapsed(event.end) }}
							</span>
							<span class="mt-0.5 block text-xs text-muted-foreground">
								{{ labels.labels.distance }} {{ formatDistance(event.distance) }} ·
								{{ labels.labels.speedRetention }} {{ formatPercentage(event.speedRetention) }}
							</span>
						</span>
						<TablerIcon name="player-play" class="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
					</button>
				</div>
			</div>
		</div>

		<div v-else class="grid min-h-40 place-items-center px-6 text-center text-sm text-muted-foreground">
			{{ labels.emptyLabel }}
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import type { GhostSlipEvent, LoadedPlaybackGhost } from '~/types/ghost'
import type { RecordAnalysisLabels } from '~/utils/recordAnalysisLabels'
import { buildRecordDriftRuns, type RecordDriftRun } from '~/utils/recordGhostAnalysis'

const props = withDefaults(
	defineProps<{
		events: GhostSlipEvent[]
		comparisonRuns?: RecordDriftRun[]
		comparisons?: LoadedPlaybackGhost[]
		primaryColor?: string
		labels: RecordAnalysisLabels['drift']
	}>(),
	{ primaryColor: '#facc15' },
)

const emit = defineEmits<{ seek: [time: number] }>()
const { locale } = useI18n()
const integerFormat = computed(() => new Intl.NumberFormat(locale.value))
const decimalFormat = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }),
)
const percentageFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }),
)
const chartDuration = ref(0)
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
const runAxisConfig = {
	tickTextAlign: 'right' as const,
	tickTextFitMode: 'trim' as const,
	tickTextFontSize: '12px',
	tickTextTrimType: 'end' as const,
	tickTextWidth: 136,
}
const runs = computed<RecordDriftRun[]>(() => [
	{
		recordId: 0,
		label: props.labels.primary,
		color: props.primaryColor,
		dashed: false,
		events: props.events,
		eventCount: props.events.length,
		totalDuration: props.events.reduce((total, event) => total + event.duration, 0),
		totalDistance: props.events.reduce((total, event) => total + event.distance, 0),
		averageSpeedRetention: averageRetention(props.events),
		worstSpeedRetention: worstRetention(props.events),
	},
	...(props.comparisonRuns ?? buildRecordDriftRuns(props.comparisons ?? [])),
])
const primaryRun = computed(() => runs.value[0])
const runKeys = computed(() => runs.value.map((run) => `record-${run.recordId}`))
const comparisonData = computed(() =>
	runs.value.map((run, runIndex) => ({
		runIndex,
		...Object.fromEntries(
			runKeys.value.map((key) => [
				key,
				key === `record-${run.recordId}` ? run.totalDuration : 0,
			]),
		),
	})),
)
const comparisonCategories = computed(() =>
	Object.fromEntries(
		runs.value.map((run) => [
			`record-${run.recordId}`,
			{ name: run.label, color: run.color },
		]),
	),
)

onMounted(() => {
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) chartDuration.value = 500
})

function formatElapsed(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds - minutes * 60
	return `${minutes}:${remainder.toFixed(3).padStart(6, '0')}`
}

function formatDuration(seconds: number) {
	return `${decimalFormat.value.format(seconds)} ${props.labels.units.seconds}`
}

function formatDistance(distance: number) {
	return `${decimalFormat.value.format(distance)} ${props.labels.units.metres}`
}

function formatPercentage(value: number | null) {
	return value === null ? props.labels.unavailableLabel : percentageFormat.value.format(value)
}

function formatRunAxis(value: number | Date) {
	if (typeof value !== 'number') return ''
	return runs.value[Math.round(value)]?.label ?? ''
}

function comparisonTooltipEntries(values: unknown): DashboardChartEntry[] {
	const run = comparisonTooltipRun(values)
	if (!run) return []
	return [
		{
			key: 'events',
			label: props.labels.labels.eventCount,
			value: run.eventCount,
			color: run.color,
			formattedValue: integerFormat.value.format(run.eventCount),
		},
		{
			key: 'duration',
			label: props.labels.labels.totalDuration,
			value: run.totalDuration,
			color: run.color,
			formattedValue: formatDuration(run.totalDuration),
		},
		{
			key: 'distance',
			label: props.labels.labels.totalDistance,
			value: run.totalDistance,
			color: run.color,
			formattedValue: formatDistance(run.totalDistance),
		},
		{
			key: 'average-retention',
			label: props.labels.labels.speedRetention,
			value: run.averageSpeedRetention ?? 0,
			color: run.color,
			formattedValue: formatPercentage(run.averageSpeedRetention),
		},
		{
			key: 'worst-retention',
			label: props.labels.labels.worstRetention,
			value: run.worstSpeedRetention ?? 0,
			color: run.color,
			formattedValue: formatPercentage(run.worstSpeedRetention),
		},
	]
}

function comparisonTooltipTitle(values: unknown) {
	return comparisonTooltipRun(values)?.label ?? ''
}

function comparisonTooltipRun(values: unknown) {
	if (!values || typeof values !== 'object') return null
	const runIndex = (values as Record<string, unknown>).runIndex
	return typeof runIndex === 'number' ? (runs.value[runIndex] ?? null) : null
}

function averageRetention(events: readonly GhostSlipEvent[]) {
	const values = events.flatMap((event) =>
		event.speedRetention === null ? [] : [event.speedRetention],
	)
	return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null
}

function worstRetention(events: readonly GhostSlipEvent[]) {
	const values = events.flatMap((event) =>
		event.speedRetention === null ? [] : [event.speedRetention],
	)
	return values.length > 0 ? Math.min(...values) : null
}
</script>
