<template>
	<div class="space-y-6">
		<div class="grid gap-4 md:grid-cols-3">
			<div
				v-for="metric in model.distanceMetrics"
				:key="metric.key"
				class="rounded-2xl border border-border/80 bg-gradient-to-br from-card to-primary/5 p-5 shadow-sm"
			>
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-sm font-medium text-muted-foreground">{{ metric.label }}</p>
						<p class="mt-2 text-3xl font-black tabular-nums tracking-tight text-highlighted">
							{{ metric.value }}
						</p>
					</div>
					<span class="rounded-xl bg-primary/10 p-2.5 text-primary">
						<TablerIcon :name="metric.icon" class="size-5" />
					</span>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<p class="font-semibold text-highlighted">{{ model.periodSelectorLabel }}</p>
					<UBadge color="primary" variant="soft">{{ model.minimumVersionLabel }}</UBadge>
				</div>
				<p class="mt-1 text-sm text-muted-foreground">{{ model.periodDescription }}</p>
			</div>
			<div class="flex rounded-xl border border-border bg-card p-1" :aria-label="model.periodSelectorLabel">
				<UButton
					:label="model.todayLabel"
					:variant="period === 'today' ? 'solid' : 'ghost'"
					color="primary"
					size="sm"
					@click="period = 'today'"
				/>
				<UButton
					:label="model.monthLabel"
					:variant="period === 'month' ? 'solid' : 'ghost'"
					color="primary"
					size="sm"
					@click="period = 'month'"
				/>
			</div>
		</div>

		<div class="grid gap-5 xl:grid-cols-2">
			<DashboardStatisticChartCard
				v-for="chart in model.charts"
				:key="chart.key"
				:title="chart.title"
				:description="chart.description"
				:icon="chart.icon"
				:kind="chart.kind"
				:half="chart.half"
				:entries="chart.data[period]"
				:total-label="chart.total[period]"
				:empty-label="model.emptyLabel"
				:class="chart.wide ? 'xl:col-span-2' : undefined"
			/>
		</div>

		<div class="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
			<DashboardDriverInputsCard
				:title="model.driverInputs.title"
				:description="model.driverInputs.description"
				:icon="model.driverInputs.icon"
				:steering-entries="model.driverInputs.steering[period]"
				:steering-total-label="model.driverInputs.steeringTotal[period]"
				:actions="model.driverInputs.actions[period]"
				:empty-label="model.emptyLabel"
			/>

			<UCard
				class="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/15 to-card shadow-sm"
			>
				<div class="flex h-full flex-col justify-between gap-6">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-sm font-semibold text-primary">{{ model.averageSpeed.title }}</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{{ model.averageSpeed.description }}
							</p>
						</div>
						<TablerIcon name="gauge" class="size-7 text-primary" />
					</div>
					<p class="text-5xl font-black tabular-nums tracking-tight text-highlighted">
						{{ model.averageSpeed.data[period] }}
					</p>
				</div>
			</UCard>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardStatisticsModel } from '~/types/app'

defineProps<{ model: DashboardStatisticsModel }>()

const period = ref<'today' | 'month'>('today')
</script>
