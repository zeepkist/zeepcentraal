<template>
	<div class="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-3 sm:p-4">
		<LineChart
			:data="history"
			:categories="categories"
			:y-axis="['points']"
			:height="220"
			:x-formatter="formatDateAtIndex"
			:line-width="3"
			:hide-legend="true"
			:duration="chartDuration"
			:tooltip="tooltipOptions"
		>
			<template #tooltip="{ values }">
				<DashboardChartTooltip
					:entries="resolveTooltipEntries(values)"
					:title="resolveTooltipTitle(values)"
					:show-percentage="false"
				/>
			</template>
		</LineChart>
	</div>
</template>

<script setup vapor lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import type { LevelPointHistoryPoint } from '~/utils/levelPointsHistory'

const props = defineProps<{
	history: LevelPointHistoryPoint[]
	seriesLabel: string
}>()

const { locale } = useI18n()
const dateFormat = computed(
	() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'Europe/London' }),
)
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const categories = computed(() => ({
	points: { name: props.seriesLabel, color: '#facc15' },
}))
const chartDuration = ref(0)
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
onMounted(() => {
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) chartDuration.value = 500
})

function formatDateAtIndex(index: number) {
	const value = props.history[index]?.date
	return value ? dateFormat.value.format(new Date(value)) : ''
}

function resolveTooltipTitle(values: unknown) {
	if (!values || typeof values !== 'object') return ''
	const date = (values as Record<string, unknown>).date
	return typeof date === 'string' ? dateFormat.value.format(new Date(date)) : ''
}

function resolveTooltipEntries(values: unknown): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const value = (values as Record<string, unknown>).points
	if (typeof value !== 'number') return []
	return [
		{
			key: 'points',
			label: props.seriesLabel,
			value,
			color: '#facc15',
			formattedValue: numberFormat.value.format(value),
		},
	]
}
</script>
