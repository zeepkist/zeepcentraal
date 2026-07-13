<template>
	<div
		v-if="entries.length"
		class="min-w-48 rounded-xl border border-border/80 bg-card/95 p-3 text-foreground shadow-xl shadow-black/10 backdrop-blur"
	>
		<div
			v-for="entry in entries"
			:key="entry.key"
			class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5 first:pt-0 last:pb-0"
		>
			<span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: entry.color }" />
			<span class="truncate text-sm font-semibold text-highlighted">{{ entry.label }}</span>
			<span class="text-right">
				<span class="block text-sm font-bold tabular-nums text-highlighted">{{ entry.formattedValue }}</span>
				<span class="block text-xs tabular-nums text-muted-foreground">{{ formatPercentage(entry.value) }}</span>
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'

const props = defineProps<{
	entries: DashboardChartEntry[]
	total: number
}>()

const { locale } = useI18n()
const percentageFormat = computed(
	() =>
		new Intl.NumberFormat(locale.value, {
			style: 'percent',
			maximumFractionDigits: 1,
		}),
)
const formatPercentage = (value: number) =>
	percentageFormat.value.format(props.total > 0 ? value / props.total : 0)
</script>
