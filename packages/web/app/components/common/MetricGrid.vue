<template>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

defineProps<{ metrics: StatisticMetric[] }>()
</script>
