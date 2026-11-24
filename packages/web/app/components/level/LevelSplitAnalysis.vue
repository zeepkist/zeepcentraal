<template>
	<div class="space-y-4">
		<div class="flex flex-wrap gap-2">
			<NuxtLink
				v-for="player in visibleSeries"
				:key="player.recordId"
				:to="player.userSteamId ? `/user/${player.userSteamId}` : `/record/${player.recordId}`"
				class="flex items-center gap-2 rounded-lg border px-3 py-2 transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				:class="player.viewer ? 'border-primary/50 bg-primary/10' : 'border-border bg-card/70'"
			>
				<span
					class="w-4 shrink-0 border-t-2"
					:class="player.viewer ? 'border-dotted' : 'border-solid'"
					:style="{ borderColor: player.color }"
				/>
				<span class="text-sm font-semibold text-highlighted">{{ player.userName }}</span>
				<span class="font-mono text-xs tabular-nums text-muted-foreground">
					{{ formatTime(player.time) }}
				</span>
			</NuxtLink>
		</div>

		<div class="grid gap-4 xl:grid-cols-2">
			<UCard
				class="overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-primary/5"
				:ui="compactCardUi"
			>
				<template #header>
					<h3 class="font-bold text-highlighted">{{ labels.deltaTitle }}</h3>
					<p class="mt-1 text-xs text-muted-foreground">{{ labels.deltaDescription }}</p>
				</template>
				<LineChart
					:data="visibleDeltaData"
					:categories="categories"
					:y-axis="seriesKeys"
					:y-domain="deltaAxis?.domain"
					:y-explicit-ticks="deltaAxis?.ticks"
					:y-formatter="formatDeltaTick"
					:padding="deltaChartPadding"
					:height="220"
					:x-formatter="formatCheckpoint"
					:line-width="3"
					:line-dash-array="lineDashArray"
					:duration="chartDuration"
					:hide-legend="true"
				>
					<template #tooltip="{ values }">
						<DashboardChartTooltip
							:entries="resolveTooltipEntries(values, 'delta')"
							:title="resolveTooltipTitle(values)"
							:show-percentage="false"
						/>
					</template>
				</LineChart>
			</UCard>

			<UCard
				class="overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-primary/5"
				:ui="compactCardUi"
			>
				<template #header>
					<h3 class="font-bold text-highlighted">{{ labels.speedTitle }}</h3>
					<p class="mt-1 text-xs text-muted-foreground">{{ labels.speedDescription }}</p>
				</template>
				<LineChart
					:data="visibleSpeedData"
					:categories="categories"
					:y-axis="seriesKeys"
					:y-domain="speedDomain"
					:height="220"
					:x-formatter="formatCheckpoint"
					:line-width="3"
					:line-dash-array="lineDashArray"
					:duration="chartDuration"
					:hide-legend="true"
				>
					<template #tooltip="{ values }">
						<DashboardChartTooltip
							:entries="resolveTooltipEntries(values, 'speed')"
							:title="resolveTooltipTitle(values)"
							:show-percentage="false"
						/>
					</template>
				</LineChart>
			</UCard>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import type { LevelSplitAnalysis } from '~/utils/levelSplitAnalysis'
import { getEvenlySpacedYAxis, getLineChartYDomain } from '~/utils/lineChartDomain'

const props = withDefaults(
	defineProps<{
		analysis: LevelSplitAnalysis
		showViewerComparison?: boolean
		labels: {
			checkpoint: string
			finish: string
			deltaTitle: string
			deltaDescription: string
			speedTitle: string
			speedDescription: string
			millisecondsUnit: string
			speedUnit: string
		}
	}>(),
	{ showViewerComparison: false },
)

const { locale } = useAppI18n()
const deltaFormat = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }),
)
const speedFormat = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
)
const visibleSeries = computed(() =>
	props.analysis.series.filter(
		(player) => !player.viewerComparison || props.showViewerComparison,
	),
)
const categories = computed(() =>
	Object.fromEntries(
		visibleSeries.value.map((player) => [
			player.key,
			{ name: player.userName, color: player.color },
		]),
	),
)
const seriesKeys = computed(() => visibleSeries.value.map((player) => player.key))
const lineDashArray = computed(() =>
	visibleSeries.value.map((player) => (player.viewer ? [2, 4] : [])),
)
const visibleDeltaData = computed(() => selectVisibleData(props.analysis.deltaData, 1000))
const visibleSpeedData = computed(() => selectVisibleData(props.analysis.speedData))
const deltaTickUnit = 10
const deltaChartPadding = { top: 20, right: 5, bottom: 5, left: 5 }
const deltaAxis = computed(() => {
	const domain = getLineChartYDomain(visibleDeltaData.value, seriesKeys.value, deltaTickUnit)
	return domain && getEvenlySpacedYAxis(domain, deltaTickUnit)
})
const speedDomain = computed(() => getLineChartYDomain(visibleSpeedData.value, seriesKeys.value))
const compactCardUi = { header: 'p-4 sm:p-4', body: 'p-3 sm:p-4' }
const chartDuration = useMotionDuration(500)

function formatCheckpoint(index: number) {
	return index >= props.analysis.checkpointCount
		? props.labels.finish
		: `${props.labels.checkpoint} ${index + 1}`
}

function formatDeltaTick(value: number | Date) {
	return typeof value === 'number'
		? `${deltaFormat.value.format(value)}${props.labels.millisecondsUnit}`
		: ''
}

function resolveTooltipTitle(values: unknown) {
	if (!values || typeof values !== 'object') return ''
	const checkpoint = (values as Record<string, unknown>).checkpoint
	return typeof checkpoint === 'number'
		? checkpoint > props.analysis.checkpointCount
			? props.labels.finish
			: `${props.labels.checkpoint} ${checkpoint}`
		: ''
}

function resolveTooltipEntries(
	values: unknown,
	mode: 'delta' | 'speed',
): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const datum = values as Record<string, unknown>
	return visibleSeries.value.flatMap((player) => {
		const value = datum[player.key]
		if (typeof value !== 'number') return []
		const formattedValue =
			mode === 'delta'
				? `${value > 0 ? '+' : ''}${formatDeltaTick(value)}`
				: `${speedFormat.value.format(value)} ${props.labels.speedUnit}`
		return [{
			key: player.key,
			label: player.userName,
			value,
			color: player.color,
			formattedValue,
		}]
	})
}

function selectVisibleData(data: Array<Record<string, number>>, scale = 1) {
	return data.map((point) => ({
		checkpoint: point.checkpoint ?? 0,
		...Object.fromEntries(
			visibleSeries.value.flatMap((player) => {
				const value = point[player.key]
				return typeof value === 'number' ? [[player.key, value * scale]] : []
			}),
		),
	}))
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
