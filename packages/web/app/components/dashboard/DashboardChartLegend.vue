<template>
	<ul class="grid gap-2" :aria-label="ariaLabel">
		<li
			v-for="entry in entries"
			:key="entry.key"
			class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 text-sm"
		>
			<span class="size-2.5 rounded-full" :style="{ backgroundColor: entry.color }" />
			<span class="min-w-0 truncate text-muted-foreground">{{ entry.label }}</span>
			<span class="text-right">
				<span class="block font-semibold tabular-nums text-highlighted">{{ entry.formattedValue }}</span>
				<span class="block text-xs tabular-nums text-muted-foreground">{{ formatPercentage(entry.value) }}</span>
			</span>
		</li>
	</ul>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'

const props = defineProps<{
	entries: DashboardChartEntry[]
	total: number
	ariaLabel: string
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
