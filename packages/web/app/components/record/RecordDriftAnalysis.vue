<template>
	<div class="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card to-primary/5">
		<div class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 p-4">
			<div>
				<h3 class="font-bold text-highlighted">{{ labels.title }}</h3>
				<p class="mt-1 text-xs text-muted-foreground">{{ labels.description }}</p>
			</div>
			<span class="rounded-lg bg-primary/10 p-1.5 text-primary">
				<TablerIcon :name="labels.icon" class="size-4" />
			</span>
		</div>

		<div v-if="runs.some((run) => run.eventCount > 0)" class="space-y-5 p-4">
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div
					v-for="metric in primaryMetrics"
					:key="metric.key"
					class="rounded-xl border border-border/70 bg-card/60 p-3"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="truncate text-xs font-medium text-muted-foreground">{{ metric.label }}</p>
							<p class="mt-1 text-xl font-black tabular-nums tracking-tight text-highlighted">
								{{ metric.value }}
							</p>
						</div>
						<TablerIcon :name="metric.icon" class="size-4 shrink-0 text-primary" />
					</div>
				</div>
			</div>

			<div v-if="runs.length > 1" class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
				<div class="rounded-xl border border-border/70 bg-card/45 p-3">
					<h4 class="mb-2 text-sm font-bold text-highlighted">{{ labels.comparisonTitle }}</h4>
					<BarChart
						:data="comparisonData"
						:categories="comparisonCategories"
						:y-axis="runs.map((run) => `record-${run.recordId}`)"
						:height="Math.max(150, runs.length * 38)"
						orientation="horizontal"
						:duration="chartDuration"
						:radius="8"
						:bar-padding="0.22"
						:tooltip="tooltipOptions"
						hide-legend
						hide-x-axis
						hide-y-axis
					>
						<template #tooltip="{ values }">
							<DashboardChartTooltip
								:entries="comparisonTooltipEntries(values)"
								:show-percentage="false"
							/>
						</template>
					</BarChart>
				</div>

				<ul class="space-y-2" :aria-label="labels.comparisonTitle">
					<li
						v-for="run in runs"
						:key="run.recordId"
						class="rounded-xl border border-border/70 bg-card/60 p-3"
					>
						<div class="flex items-center gap-2">
							<span class="size-2.5 rounded-full" :style="{ backgroundColor: run.color }" />
							<span class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">
								{{ run.label }}
							</span>
							<span class="text-xs tabular-nums text-muted-foreground">
								{{ formatDuration(run.totalDuration) }}
							</span>
						</div>
						<div class="mt-2 grid grid-cols-2 gap-2 text-xs">
							<span class="text-muted-foreground">{{ labels.labels.eventCount }}</span>
							<span class="text-right font-semibold tabular-nums text-highlighted">
								{{ integerFormat.format(run.eventCount) }}
							</span>
							<span class="text-muted-foreground">{{ labels.labels.speedRetention }}</span>
							<span class="text-right font-semibold tabular-nums text-highlighted">
								{{ formatPercentage(run.averageSpeedRetention) }}
							</span>
						</div>
					</li>
				</ul>
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

const props = defineProps<{
	events: GhostSlipEvent[]
	comparisonRuns?: RecordDriftRun[]
	comparisons?: LoadedPlaybackGhost[]
	labels: RecordAnalysisLabels['drift']
}>()

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
const runs = computed<RecordDriftRun[]>(() => [
	{
		recordId: 0,
		label: props.labels.primary,
		color: '#facc15',
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
const primaryMetrics = computed(() => {
	const run = primaryRun.value
	if (!run) return []
	return [
		{
			key: 'events',
			label: props.labels.labels.eventCount,
			value: integerFormat.value.format(run.eventCount),
			icon: 'wind',
		},
		{
			key: 'duration',
			label: props.labels.labels.totalDuration,
			value: formatDuration(run.totalDuration),
			icon: 'clock',
		},
		{
			key: 'distance',
			label: props.labels.labels.totalDistance,
			value: formatDistance(run.totalDistance),
			icon: 'route',
		},
		{
			key: 'retention',
			label: props.labels.labels.worstRetention,
			value: formatPercentage(run.worstSpeedRetention),
			icon: 'gauge',
		},
	]
})
const comparisonData = computed(() => [
	Object.fromEntries(runs.value.map((run) => [`record-${run.recordId}`, run.totalDuration])),
])
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

function comparisonTooltipEntries(values: unknown): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const datum = values as Record<string, unknown>
	return runs.value.flatMap((run) => {
		const key = `record-${run.recordId}`
		const value = datum[key]
		if (typeof value !== 'number') return []
		return [{ key, label: run.label, value, color: run.color, formattedValue: formatDuration(value) }]
	})
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
