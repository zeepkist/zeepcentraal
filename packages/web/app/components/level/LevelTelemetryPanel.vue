<template>
	<div class="space-y-6">
		<div class="flex flex-wrap items-center gap-2">
			<UBadge color="primary" variant="soft">{{ model.minimumVersionLabel }}</UBadge>
			<p class="text-sm text-muted-foreground">{{ description }}</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<div
				v-for="metric in model.overviewMetrics"
				:key="metric.key"
				class="rounded-2xl border border-border/80 bg-gradient-to-br from-card to-primary/5 p-5 shadow-sm"
			>
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-sm font-medium text-muted-foreground">{{ metric.label }}</p>
						<p class="mt-2 text-2xl font-black tabular-nums tracking-tight text-highlighted">
							{{ metric.value }}
						</p>
					</div>
					<span class="rounded-xl bg-primary/10 p-2.5 text-primary">
						<TablerIcon :name="metric.icon" class="size-5" />
					</span>
				</div>
			</div>
		</div>

		<div class="grid gap-5 xl:grid-cols-2">
			<UCard
				v-for="chart in model.charts"
				:key="chart.key"
				class="h-full overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm"
			>
				<template #header>
					<div class="flex items-start justify-between gap-4">
						<div>
							<h3 class="font-bold text-highlighted">{{ chart.title }}</h3>
							<p class="mt-1 text-sm text-muted-foreground">{{ chart.description }}</p>
						</div>
						<span class="rounded-lg bg-primary/10 p-2 text-primary">
							<TablerIcon :name="chart.icon" class="size-5" />
						</span>
					</div>
				</template>
				<DashboardDonutChart
					v-if="chart.entries.some((entry) => entry.value > 0)"
					:entries="chart.entries"
					:total-label="chart.totalLabel"
					:aria-label="chart.title"
				/>
				<div v-else class="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
					{{ model.emptyLabel }}
				</div>
			</UCard>

			<DashboardDriverInputsCard
				:title="model.driverInputs.title"
				:description="model.driverInputs.description"
				:icon="model.driverInputs.icon"
				:steering-entries="model.driverInputs.steering"
				:steering-total-label="model.driverInputs.steeringTotalLabel"
				:actions="model.driverInputs.actions"
				:empty-label="model.emptyLabel"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { LevelTelemetryModel } from '~/types/app'

defineProps<{
	model: LevelTelemetryModel
	description: string
}>()
</script>
