<template>
	<div class="space-y-4">
		<div v-for="series in seriesModels" :key="series.group" class="rounded-2xl border border-border bg-linear-to-br from-card to-primary/5 p-3 sm:p-4">
			<div class="mb-2 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 class="font-bold text-highlighted">{{ series.title }}</h3>
					<p class="mt-1 text-xs text-muted-foreground">{{ series.description }}</p>
				</div>
				<ChartSeriesTabs
					v-if="series.group === 'points'"
					:model-value="pointsSeries"
					:label="labels.pointsToggleLabel"
					:options="pointsOptions"
					@update:model-value="pointsSeries = $event"
				/>
				<ChartSeriesTabs
					v-else
					:model-value="standingSeries"
					:label="labels.standingToggleLabel"
					:options="standingOptions"
					@update:model-value="standingSeries = $event"
				/>
			</div>
			<div class="relative h-[220px]">
				<div
					v-if="!hydrated"
					class="absolute inset-0 grid place-items-center text-primary"
					role="status"
					:aria-label="labels.loading"
				>
					<TablerIcon name="loader-2" class="size-7 motion-safe:animate-spin" />
					<span class="sr-only">{{ labels.loading }}</span>
				</div>
				<LineChart v-else :data="series.data" :categories="{ value: { name: series.title, color: series.color } }" :y-axis="['value']" :height="220" :x-formatter="(index: number) => formatDate(series.data[index]?.date)" :y-formatter="series.inverted ? formatRankTick : formatCompactTick" :line-width="3" :hide-legend="true" :duration="duration" :tooltip="tooltipOptions">
					<template #tooltip="{ values }">
						<DashboardChartTooltip :entries="tooltipEntries(values, series)" :title="tooltipTitle(values)" :show-percentage="false" />
					</template>
				</LineChart>
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import type {
	DashboardChartEntry,
	UserCareerHistoryPoint,
	UserCareerSecondaryHistoryPoint,
} from '~/types/app'
import { createUserCareerAxisFormatter } from '~/utils/userCareerHistory'

type PointsSeries = 'rankedPoints' | 'totalPoints'
type StandingSeries = 'rank' | 'worldRecords'

const props = defineProps<{
	history: UserCareerHistoryPoint[]
	secondaryHistory: UserCareerSecondaryHistoryPoint[]
	secondaryReady: boolean
	labels: {
		rankedPoints: string
		rankedPointsDescription: string
		totalPoints: string
		totalPointsDescription: string
		rank: string
		rankDescription: string
		worldRecords: string
		worldRecordsDescription: string
		pointsToggleLabel: string
		standingToggleLabel: string
		loading: string
	}
}>()
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const compactNumber = computed(() => createUserCareerAxisFormatter(locale.value))
const date = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'Europe/London' }))
const duration = ref(0)
const hydrated = ref(false)
const pointsSeries = ref<PointsSeries>('rankedPoints')
const standingSeries = ref<StandingSeries>('rank')
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }

onMounted(() => {
	hydrated.value = true
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) duration.value = 500
})

const pointsOptions = computed(() => [
	{ value: 'rankedPoints' as const, label: props.labels.rankedPoints, icon: 'chart-line' },
	{
		value: 'totalPoints' as const,
		label: props.labels.totalPoints,
		icon: 'sum',
		disabled: !props.secondaryReady,
	},
])

const standingOptions = computed(() => [
	{ value: 'rank' as const, label: props.labels.rank, icon: 'laurel-wreath-1' },
	{
		value: 'worldRecords' as const,
		label: props.labels.worldRecords,
		icon: 'trophy',
		disabled: !props.secondaryReady,
	},
])

const seriesModels = computed(() => [
	pointsSeries.value === 'rankedPoints'
		? { group: 'points' as const, key: 'rankedPoints', title: props.labels.rankedPoints, description: props.labels.rankedPointsDescription, color: '#facc15', inverted: false, data: props.history.map((point) => ({ date: point.date, value: point.rankedPoints })) }
		: { group: 'points' as const, key: 'totalPoints', title: props.labels.totalPoints, description: props.labels.totalPointsDescription, color: '#a855f7', inverted: false, data: props.secondaryHistory.map((point) => ({ date: point.date, value: point.totalPoints })) },
	standingSeries.value === 'rank'
		? { group: 'standing' as const, key: 'rank', title: props.labels.rank, description: props.labels.rankDescription, color: '#38bdf8', inverted: true, data: props.history.flatMap((point) => point.rank == null ? [] : [{ date: point.date, value: -point.rank }]) }
		: { group: 'standing' as const, key: 'worldRecords', title: props.labels.worldRecords, description: props.labels.worldRecordsDescription, color: '#f43f5e', inverted: false, data: props.secondaryHistory.map((point) => ({ date: point.date, value: point.worldRecords })) },
])

function formatDate(value?: string) { return value ? date.value.format(new Date(value)) : '' }

function formatCompactTick(value: number | Date) { return typeof value === 'number' ? compactNumber.value.format(value) : '' }

function formatRankTick(value: number | Date) { return typeof value === 'number' ? `#${compactNumber.value.format(Math.abs(value))}` : '' }

function tooltipTitle(values: unknown) { const value = values as { date?: unknown } | null; return typeof value?.date === 'string' ? formatDate(value.date) : '' }

function tooltipEntries(values: unknown, series: (typeof seriesModels.value)[number]): DashboardChartEntry[] { const value = values as { value?: unknown } | null; if (typeof value?.value !== 'number') return []; const displayValue = series.inverted ? Math.abs(value.value) : value.value; return [{ key: series.key, label: series.title, value: displayValue, color: series.color, formattedValue: series.inverted ? `#${number.value.format(displayValue)}` : number.value.format(displayValue) }] }
</script>
