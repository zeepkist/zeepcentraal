<template>
	<div class="grid gap-4 xl:grid-cols-2">
		<UCard
			v-for="chart in visibleCharts"
			:key="chart.key"
			class="overflow-hidden rounded-2xl border-border/80 bg-linear-to-br from-card to-primary/5"
			:ui="compactCardUi"
		>
			<template #header>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h3 class="font-bold text-highlighted">{{ chart.config.title }}</h3>
						<p class="mt-1 text-xs text-muted-foreground">{{ chart.config.description }}</p>
					</div>
					<span class="shrink-0 rounded-lg bg-primary/10 p-1.5 text-primary">
						<TablerIcon :name="chart.config.icon" class="size-4" />
					</span>
				</div>
			</template>

			<LineChart
				:data="chart.data"
				:categories="categories(chart)"
				:y-axis="chart.series.map((series) => series.key)"
				:height="chartHeight"
				:x-formatter="(index: number) => formatElapsed(chart.data[index]?.elapsed)"
				:y-formatter="(value: number | Date) => formatAxisValue(value, chart.config)"
				:line-width="3"
				:line-dash-array="chart.series.map((series) => (series.dashed ? [3, 5] : []))"
				:duration="chartDuration"
				:hide-legend="true"
				:tooltip="tooltipOptions"
			>
				<template #tooltip="{ values }">
					<DashboardChartTooltip
						:entries="tooltipEntries(values, chart)"
						:title="tooltipTitle(values)"
						:show-percentage="false"
					/>
				</template>
			</LineChart>
			<ul class="mt-2 flex flex-wrap gap-2" :aria-label="chart.config.title">
				<li
					v-for="series in chart.series"
					:key="series.key"
					class="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-1 text-xs text-muted-foreground"
				>
					<span
						class="w-4 border-t-2"
						:class="series.dashed ? 'border-dashed' : 'border-solid'"
						:style="{ borderColor: series.color }"
					/>
					<span class="max-w-40 truncate">{{ series.label }}</span>
				</li>
			</ul>
		</UCard>

		<div
			v-if="visibleCharts.length === 0"
			class="col-span-full grid min-h-48 place-items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 text-center text-sm text-muted-foreground"
		>
			{{ labels.emptyLabel }}
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import type { LoadedPlaybackGhost, ParsedPlaybackGhost } from '~/types/ghost'
import type { RecordAnalysisLabels } from '~/utils/recordAnalysisLabels'
import {
	buildRecordTelemetryChartsFromSources,
	type RecordTelemetryChartData,
} from '~/utils/recordGhostAnalysis'

type RecordTelemetryChartConfig = RecordAnalysisLabels['telemetry']['config'][keyof RecordAnalysisLabels['telemetry']['config']]

type VisibleChart = RecordTelemetryChartData & { config: RecordTelemetryChartConfig }

const props = withDefaults(
	defineProps<{
		ghost: ParsedPlaybackGhost
		comparisons: LoadedPlaybackGhost[]
		primaryColor?: string
		labels: RecordAnalysisLabels['telemetry']
	}>(),
	{ primaryColor: '#facc15' },
)

const { locale } = useI18n()
const chartDuration = ref(0)
const compactCardUi = { header: 'p-4 sm:p-4', body: 'p-3 sm:p-4' }
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
const chartHeight = 240
const charts = computed(() =>
	buildRecordTelemetryChartsFromSources([
		{
			key: 'primary',
			recordId: 0,
			label: props.labels.primary,
			color: props.primaryColor,
			dashed: false,
			frames: props.ghost.frames,
		},
		...props.comparisons.map((comparison) => ({
			key: `record-${comparison.record.recordId}`,
			recordId: comparison.record.recordId,
			label: comparison.identity.label,
			color: comparison.identity.bodyColor,
			dashed: (comparison.identity.userRunOrdinal ?? 0) > 1,
			frames: comparison.ghost.frames,
		})),
	]),
)
const visibleCharts = computed<VisibleChart[]>(() =>
	charts.value.flatMap((chart) => {
		const series = chart.series.filter((entry) =>
			chart.data.some((point) => typeof point[entry.key] === 'number'),
		)
		return series.length > 0 ? [{ ...chart, series, config: props.labels.config[chart.key] }] : []
	}),
)

onMounted(() => {
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) chartDuration.value = 500
})

function categories(chart: VisibleChart) {
	return Object.fromEntries(
		chart.series.map((series) => [series.key, { name: series.label, color: series.color }]),
	)
}

function formatElapsed(value?: number) {
	if (typeof value !== 'number') return ''
	const minutes = Math.floor(value / 60)
	const seconds = value - minutes * 60
	return minutes > 0
		? `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
		: `${seconds.toFixed(1)} ${props.labels.secondsUnit}`
}

function numberFormat(config: RecordTelemetryChartConfig) {
	return new Intl.NumberFormat(locale.value, {
		maximumFractionDigits: config.maximumFractionDigits ?? 1,
	})
}

function formatAxisValue(value: number | Date, config: RecordTelemetryChartConfig) {
	return typeof value === 'number' ? numberFormat(config).format(value) : ''
}

function tooltipTitle(values: unknown) {
	if (!values || typeof values !== 'object') return ''
	const elapsed = (values as Record<string, unknown>).elapsed
	return typeof elapsed === 'number' ? formatElapsed(elapsed) : ''
}

function tooltipEntries(values: unknown, chart: VisibleChart): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const datum = values as Record<string, unknown>
	return chart.series.flatMap((series) => {
		const value = datum[series.key]
		if (typeof value !== 'number') return []
		return [
			{
				key: series.key,
				label: series.label,
				value,
				color: series.color,
				formattedValue: `${numberFormat(chart.config).format(value)} ${chart.config.unit}`.trim(),
			},
		]
	})
}

</script>
