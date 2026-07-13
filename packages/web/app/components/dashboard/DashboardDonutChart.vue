<template>
	<div class="grid items-center gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(13rem,1.05fr)]">
		<div class="telemetry-donut relative min-h-56 overflow-hidden rounded-xl from-primary/5 via-transparent to-secondary/5">
			<div class="pointer-events-none absolute inset-1/4 rounded-full bg-primary/10 blur-3xl" />
			<DonutChart
				:data="chartValues"
				:categories="categories"
				:radius="half ? 96 : 88"
				:height="224"
				:arc-width="half ? 34 : 30"
				:pad-angle="0.035"
				:type="half ? 'half' : 'full'"
				:duration="chartDuration"
				:tooltip="tooltipOptions"
				hide-legend
			>
				<div class="flex max-w-32 flex-col items-center text-center">
					<span class="text-lg font-black tabular-nums leading-tight text-highlighted">{{ totalLabel }}</span>
				</div>
				<template #tooltip="{ values }">
					<DashboardChartTooltip
						:entries="resolveTooltipEntries(values)"
						:total="total"
					/>
				</template>
			</DonutChart>
		</div>
		<DashboardChartLegend :entries="entries" :total="total" :aria-label="ariaLabel" />
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'

const props = withDefaults(
	defineProps<{
		entries: DashboardChartEntry[]
		totalLabel: string
		ariaLabel: string
		half?: boolean
	}>(),
	{ half: false },
)

const reducedMotion = ref(false)
onMounted(() => {
	reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

const chartDuration = computed(() => (reducedMotion.value ? 0 : 650))
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
const total = computed(() => props.entries.reduce((sum, entry) => sum + entry.value, 0))
const chartValues = computed(() => props.entries.map((entry) => entry.value))
const categories = computed(() =>
	Object.fromEntries(
		props.entries.map((entry) => [entry.key, { name: entry.label, color: entry.color }]),
	),
)

function resolveTooltipEntries(values: unknown): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const datum = values as Record<string, unknown>
	const label = typeof datum.label === 'string' ? datum.label : undefined
	const entry = props.entries.find((candidate) => candidate.label === label)
	return entry ? [entry] : []
}
</script>

<style scoped>
.telemetry-donut {
	--vis-donut-background-color: transparent;
	--vis-donut-segment-stroke-color: transparent;
}
</style>
