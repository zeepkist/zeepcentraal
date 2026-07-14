<template>
	<div class="grid gap-4 sm:grid-cols-2" :class="columns === 3 ? 'xl:grid-cols-3' : undefined">
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

<script setup lang="ts">
import type { StatisticMetric } from '~/types/app'

withDefaults(defineProps<{ metrics: StatisticMetric[]; columns?: 2 | 3 }>(), { columns: 3 })
</script>
