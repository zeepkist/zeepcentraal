<template>
	<UCard
		class="h-full overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm"
		:ui="compact ? compactCardUi : undefined"
	>
		<template #header>
			<div class="flex items-start justify-between gap-3">
				<div>
					<h3 class="font-bold text-highlighted">{{ title }}</h3>
					<p
						class="mt-1 text-muted-foreground"
						:class="compact ? 'line-clamp-2 text-xs' : 'text-sm'"
					>
						{{ description }}
					</p>
				</div>
				<span
					class="rounded-lg bg-primary/10 text-primary"
					:class="compact ? 'p-1.5' : 'p-2'"
				>
					<TablerIcon :name="icon" class="size-5" />
				</span>
			</div>
		</template>

		<div :class="compact ? 'space-y-3' : 'space-y-5'">
			<DashboardDonutChart
				v-if="steeringTotal > 0"
				:entries="steeringEntries"
				:total-label="steeringTotalLabel"
				:aria-label="title"
				:compact="compact"
				half
			/>
			<div
				v-else
				class="flex items-center justify-center text-sm text-muted-foreground"
				:class="compact ? 'min-h-40' : 'min-h-56'"
			>
				{{ emptyLabel }}
			</div>

			<USeparator />

			<div class="grid gap-2 sm:grid-cols-3">
				<div
					v-for="metric in actions"
					:key="metric.key"
					class="rounded-xl border border-border/50 bg-muted/30"
					:class="compact ? 'p-3' : 'p-4'"
				>
					<TablerIcon :name="metric.icon" class="size-4 text-primary" />
					<p
						class="font-black tabular-nums text-highlighted"
						:class="compact ? 'mt-2 text-xl' : 'mt-4 text-2xl'"
					>
						{{ metric.value }}
					</p>
					<p class="mt-1 text-xs text-muted-foreground">{{ metric.label }}</p>
				</div>
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import type { DashboardChartEntry, DashboardStatisticsMetric } from '~/types/app'

const props = withDefaults(
	defineProps<{
		title: string
		description: string
		icon: string
		steeringEntries: DashboardChartEntry[]
		steeringTotalLabel: string
		actions: DashboardStatisticsMetric[]
		emptyLabel: string
		compact?: boolean
	}>(),
	{ compact: false },
)

const compactCardUi = { header: 'p-4 sm:p-4', body: 'p-4 sm:p-4' }
const steeringTotal = computed(() =>
	props.steeringEntries.reduce((total, entry) => total + entry.value, 0),
)
</script>
