<template>
	<div
		class="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-2xl shadow-primary/5 sm:p-6"
	>
		<div class="pointer-events-none absolute -right-28 -top-28 size-72 rounded-full bg-primary/10 blur-3xl" />
		<div class="pointer-events-none absolute -bottom-32 -left-24 size-72 rounded-full bg-secondary/10 blur-3xl" />

		<div class="relative space-y-6">
			<div class="grid gap-4 md:grid-cols-3">
				<div
					v-for="metric in model.distanceMetrics"
					:key="metric.key"
					class="group rounded-2xl border border-border/80 bg-card/75 p-5 backdrop-blur transition hover:border-primary/40 motion-safe:hover:-translate-y-0.5"
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

			<div class="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/65 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<p class="font-semibold text-highlighted">{{ model.periodSelectorLabel }}</p>
						<UBadge color="primary" variant="soft">{{ model.minimumVersionLabel }}</UBadge>
					</div>
					<p class="mt-1 text-sm text-muted-foreground">{{ model.periodDescription }}</p>
				</div>
				<div class="flex rounded-xl border border-border bg-muted/50 p-1" :aria-label="model.periodSelectorLabel">
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
					:empty-label="model.emptyLabel"
					:class="chart.wide ? 'xl:col-span-2' : undefined"
				/>
			</div>

			<div class="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
				<UCard class="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/15 to-card">
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

				<UCard class="rounded-2xl border-border bg-card/80">
					<template #header>
						<div>
							<h3 class="font-bold text-highlighted">{{ model.actions.title }}</h3>
							<p class="mt-1 text-sm text-muted-foreground">{{ model.actions.description }}</p>
						</div>
					</template>
					<div class="grid gap-3 sm:grid-cols-3">
						<div
							v-for="metric in model.actions.data[period]"
							:key="metric.key"
							class="rounded-xl bg-muted/45 p-4 transition hover:bg-primary/10"
						>
							<TablerIcon :name="metric.icon" class="size-5 text-primary" />
							<p class="mt-4 text-2xl font-black tabular-nums text-highlighted">{{ metric.value }}</p>
							<p class="mt-1 text-xs text-muted-foreground">{{ metric.label }}</p>
						</div>
					</div>
				</UCard>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardStatisticsModel } from '~/types/app'

defineProps<{ model: DashboardStatisticsModel }>()

const period = ref<'today' | 'month'>('today')
</script>
