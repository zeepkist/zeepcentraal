<template>
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]">
		<div class="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-4 sm:p-6">
			<LineChart
				:data="history"
				:categories="categories"
				:y-axis="['points']"
				:height="320"
				:x-formatter="formatDateAtIndex"
				:line-width="3"
				:hide-legend="true"
				:duration="chartDuration"
			/>
		</div>
		<div class="grid grid-cols-2 gap-3 xl:grid-cols-1">
			<div
				v-for="metric in metrics"
				:key="metric.key"
				class="rounded-xl border border-border bg-card/75 px-4 py-3"
			>
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{{ metric.label }}
				</p>
				<p class="mt-1 text-xl font-black tabular-nums text-highlighted">
					{{ metric.value }}
				</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { LevelPointHistoryPoint } from '~/utils/levelPointsHistory'

const props = defineProps<{
	history: LevelPointHistoryPoint[]
	metrics: Array<{ key: string; label: string; value: string }>
	seriesLabel: string
}>()

const { locale } = useI18n()
const dateFormat = computed(
	() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'Europe/London' }),
)
const categories = computed(() => ({
	points: { name: props.seriesLabel, color: '#facc15' },
}))
const chartDuration = ref(0)
onMounted(() => {
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) chartDuration.value = 500
})

function formatDateAtIndex(index: number) {
	const value = props.history[index]?.date
	return value ? dateFormat.value.format(new Date(value)) : ''
}

</script>
