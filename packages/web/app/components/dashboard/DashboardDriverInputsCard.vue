<template>
	<UCard class="h-full overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
		<template #header>
			<div class="flex items-start justify-between gap-4">
				<div>
					<h3 class="font-bold text-highlighted">{{ title }}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
				</div>
				<span class="rounded-lg bg-primary/10 p-2 text-primary">
					<TablerIcon :name="icon" class="size-5" />
				</span>
			</div>
		</template>

		<div class="space-y-5">
			<DashboardDonutChart
				v-if="steeringTotal > 0"
				:entries="steeringEntries"
				:total-label="steeringTotalLabel"
				:aria-label="title"
				half
			/>
			<div v-else class="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
				{{ emptyLabel }}
			</div>

			<USeparator />

			<div class="grid gap-3 sm:grid-cols-3">
				<div
					v-for="metric in actions"
					:key="metric.key"
					class="rounded-xl border border-border/50 bg-muted/30 p-4"
				>
					<TablerIcon :name="metric.icon" class="size-5 text-primary" />
					<p class="mt-4 text-2xl font-black tabular-nums text-highlighted">{{ metric.value }}</p>
					<p class="mt-1 text-xs text-muted-foreground">{{ metric.label }}</p>
				</div>
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import type { DashboardChartEntry, DashboardStatisticsMetric } from '~/types/app'

const props = defineProps<{
	title: string
	description: string
	icon: string
	steeringEntries: DashboardChartEntry[]
	steeringTotalLabel: string
	actions: DashboardStatisticsMetric[]
	emptyLabel: string
}>()

const steeringTotal = computed(() =>
	props.steeringEntries.reduce((total, entry) => total + entry.value, 0),
)
</script>
