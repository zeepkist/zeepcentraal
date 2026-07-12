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

		<div v-if="total > 0">
			<DashboardDonutChart
				v-if="kind === 'donut'"
				:entries="entries"
				:total-label="totalLabel"
				:aria-label="title"
				:half="half"
			/>

			<div v-else class="space-y-5">
				<div class="rounded-xl bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 px-2 py-3 sm:px-4">
					<BarChart
						:data="barData"
						:categories="barCategories"
						:y-axis="barKeys"
						:height="barHeight"
						orientation="horizontal"
						:duration="chartDuration"
						:radius="10"
						:bar-padding="0.22"
						:padding="{ top: 8, right: 8, bottom: 8, left: 8 }"
						:tooltip="tooltipOptions"
						hide-legend
						hide-x-axis
						hide-y-axis
					>
						<template #tooltip="{ values }">
							<DashboardChartTooltip :entries="resolveTooltipEntries(values)" :total="total" />
						</template>
					</BarChart>
				</div>
				<DashboardChartLegend :entries="entries" :total="total" :aria-label="title" />
			</div>
		</div>
		<div v-else class="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
			{{ emptyLabel }}
		</div>
	</UCard>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'

const props = withDefaults(
	defineProps<{
		title: string
		description: string
		icon: string
		kind: 'donut' | 'bar'
		entries: DashboardChartEntry[]
		emptyLabel: string
		totalLabel?: string
		half?: boolean
	}>(),
	{ half: false, totalLabel: '' },
)

const reducedMotion = ref(false)
onMounted(() => {
	reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

const chartDuration = computed(() => (reducedMotion.value ? 0 : 650))
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
const total = computed(() => props.entries.reduce((sum, entry) => sum + entry.value, 0))
const barData = computed(() => [
	Object.fromEntries(props.entries.map((entry) => [entry.key, entry.value])),
])
const barKeys = computed(() => props.entries.map((entry) => entry.key))
const barCategories = computed(() =>
	Object.fromEntries(
		props.entries.map((entry) => [entry.key, { name: entry.label, color: entry.color }]),
	),
)
const barHeight = computed(() => Math.max(220, props.entries.length * 48))

function resolveTooltipEntries(values: unknown): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const datum = values as Record<string, unknown>
	return props.entries.filter((entry) => typeof datum[entry.key] === 'number')
}
</script>
