<template>
	<div
		v-if="entry"
		class="min-w-44 rounded-xl border border-border/80 bg-card/95 p-3 text-foreground shadow-xl shadow-black/10 backdrop-blur"
	>
		<div class="flex items-center gap-2">
			<span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: entry.color }" />
			<span class="font-semibold text-highlighted">{{ entry.label }}</span>
		</div>
		<div class="mt-2 flex items-end justify-between gap-4">
			<span class="font-bold tabular-nums text-highlighted">{{ entry.formattedValue }}</span>
			<span class="text-xs tabular-nums text-muted-foreground">{{ percentage }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'

defineProps<{
	entry?: DashboardChartEntry
	percentage: string
}>()
</script>
