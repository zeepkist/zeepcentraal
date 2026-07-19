<template>
	<div class="space-y-4">
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<div
				v-for="metric in metrics"
				:key="metric.key"
				class="rounded-xl border border-border/80 bg-linear-to-br from-card to-primary/5 p-3 shadow-sm"
			>
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="truncate text-xs font-medium text-muted-foreground">{{ metric.label }}</p>
						<p class="mt-1 text-xl font-black tabular-nums tracking-tight text-highlighted">
							{{ metric.value }}
						</p>
					</div>
					<span class="rounded-lg bg-primary/10 p-1.5 text-primary">
						<TablerIcon :name="metric.icon" class="size-4" />
					</span>
				</div>
			</div>
		</div>

		<div v-if="distributions.length > 0" class="grid gap-4 xl:grid-cols-2">
			<div
				v-for="distribution in distributions"
				:key="distribution.key"
				class="overflow-hidden rounded-2xl border border-border/80 bg-linear-to-br from-card to-primary/5 shadow-sm"
			>
				<div class="flex items-start justify-between gap-3 border-b border-border/80 p-4">
					<div>
						<h3 class="font-bold text-highlighted">{{ distribution.title }}</h3>
						<p class="mt-1 text-xs text-muted-foreground">{{ distribution.description }}</p>
					</div>
					<span class="rounded-lg bg-primary/10 p-1.5 text-primary">
						<TablerIcon :name="distribution.icon" class="size-4" />
					</span>
				</div>
				<div class="p-3 sm:p-4">
					<DashboardDonutChart
						v-if="distribution.entries.some((entry) => entry.value > 0)"
						:entries="distribution.entries"
						:total-label="distribution.totalLabel"
						:aria-label="distribution.title"
						compact
					/>
					<div v-else class="grid min-h-40 place-items-center text-sm text-muted-foreground">
						{{ emptyLabel }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry, DashboardStatisticsMetric } from '~/types/app'

export type RecordTelemetryDistribution = {
	key: string
	title: string
	description: string
	icon: string
	entries: DashboardChartEntry[]
	totalLabel: string
}

defineProps<{
	metrics: DashboardStatisticsMetric[]
	distributions: RecordTelemetryDistribution[]
	emptyLabel: string
}>()
</script>
