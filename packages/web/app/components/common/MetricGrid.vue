<template>
	<div
		class="grid gap-4"
		:class="{
			'2xl:grid-cols-3 xl:grid-cols-2': columns === 3,
			'2xl:grid-cols-2 xl:grid-cols-1': columns === 2,
			'2xl:grid-cols-1 xl:grid-cols-1': columns === 1,
		}"
	>
		<StatCard
			v-for="metric in metrics"
			:key="metric.key"
			:details="metric.details"
			:icon="metric.icon ?? 'dashboard'"
			:label="metric.label"
			:value="metric.value"
			:value-label="metric.valueLabel"
			:to="metric.to"
		/>
	</div>
</template>

<script setup vapor lang="ts">
import type { StatisticMetric } from '~/types/app'

withDefaults(defineProps<{ metrics: StatisticMetric[]; columns?: 1 | 2 | 3 }>(), { columns: 3 })
</script>
