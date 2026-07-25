<template>
	<div class="space-y-4">
		<div class="flex flex-wrap items-center gap-2">
			<UBadge color="primary" variant="soft">{{ model.minimumVersionLabel }}</UBadge>
			<p class="text-xs text-muted-foreground">{{ description }}</p>
		</div>

		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<div
				v-for="metric in model.overviewMetrics"
				:key="metric.key"
				class="rounded-xl border border-border/80 bg-gradient-to-br from-card to-primary/5 p-3 shadow-sm"
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

		<div class="grid gap-4 xl:grid-cols-2">
			<UCard
				v-for="chart in model.charts"
				:key="chart.key"
				class="h-full overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm"
				:ui="compactCardUi"
			>
				<template #header>
					<div class="flex items-start justify-between gap-3">
						<div>
							<h3 class="font-bold text-highlighted">{{ chart.title }}</h3>
							<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
								{{ chart.description }}
							</p>
						</div>
						<span class="rounded-lg bg-primary/10 p-1.5 text-primary">
							<TablerIcon :name="chart.icon" class="size-4" />
						</span>
					</div>
				</template>
				<div
					v-if="chart.unavailable"
					class="flex min-h-40 items-center justify-center text-sm font-semibold text-muted-foreground"
				>
					{{ model.unavailableLabel }}
				</div>
				<DashboardDonutChart
					v-else-if="chart.entries.some((entry) => entry.value > 0)"
					:entries="chart.entries"
					:total-label="chart.totalLabel"
					:aria-label="chart.title"
					compact
				/>
				<div v-else class="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
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
				:unavailable="model.driverInputs.unavailable"
				:unavailable-label="model.unavailableLabel"
				compact
			/>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import type { LevelTelemetryModel } from '~/types/app'

defineProps<{
	model: LevelTelemetryModel
	description: string
}>()

const compactCardUi = { header: 'p-4 sm:p-4', body: 'p-3 sm:p-4' }
</script>
