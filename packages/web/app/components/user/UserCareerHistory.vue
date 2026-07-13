<template>
	<div class="grid gap-4 lg:grid-cols-3">
		<div v-for="series in seriesModels" :key="series.key" class="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-3 sm:p-4">
			<div class="mb-2">
				<h3 class="font-bold text-highlighted">{{ series.title }}</h3>
				<p class="mt-1 text-xs text-muted-foreground">{{ series.description }}</p>
			</div>
			<LineChart :data="series.data" :categories="{ value: { name: series.title, color: series.color } }" :y-axis="['value']" :height="220" :x-formatter="(index: number) => formatDate(series.data[index]?.date)" :line-width="3" :hide-legend="true" :duration="duration" :tooltip="tooltipOptions">
				<template #tooltip="{ values }">
					<DashboardChartTooltip :entries="tooltipEntries(values, series)" :title="tooltipTitle(values)" :show-percentage="false" />
				</template>
			</LineChart>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry, UserCareerHistoryPoint } from '~/types/app'

const props = defineProps<{
	history: UserCareerHistoryPoint[]
	labels: { rankedPoints: string; rankedPointsDescription: string; totalPoints: string; totalPointsDescription: string; rank: string; rankDescription: string }
}>()
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const date = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'Europe/London' }))
const duration = ref(0)
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
onMounted(() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) duration.value = 500 })
const seriesModels = computed(() => [
	{ key: 'rankedPoints', title: props.labels.rankedPoints, description: props.labels.rankedPointsDescription, color: '#facc15', data: props.history.map((point) => ({ date: point.date, value: point.rankedPoints })) },
	{ key: 'totalPoints', title: props.labels.totalPoints, description: props.labels.totalPointsDescription, color: '#a855f7', data: props.history.map((point) => ({ date: point.date, value: point.totalPoints })) },
	{ key: 'rank', title: props.labels.rank, description: props.labels.rankDescription, color: '#38bdf8', data: props.history.flatMap((point) => point.rank == null ? [] : [{ date: point.date, value: point.rank }]) },
])
function formatDate(value?: string) { return value ? date.value.format(new Date(value)) : '' }
function tooltipTitle(values: unknown) { const value = values as { date?: unknown } | null; return typeof value?.date === 'string' ? formatDate(value.date) : '' }
function tooltipEntries(values: unknown, series: (typeof seriesModels.value)[number]): DashboardChartEntry[] { const value = values as { value?: unknown } | null; return typeof value?.value === 'number' ? [{ key: series.key, label: series.title, value: value.value, color: series.color, formattedValue: series.key === 'rank' ? `#${number.value.format(value.value)}` : number.value.format(value.value) }] : [] }
</script>
