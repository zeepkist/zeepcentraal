<template>
	<div :class="layoutClass">
		<div
			class="telemetry-donut relative overflow-hidden rounded-xl from-primary/5 via-transparent to-secondary/5"
			:class="compact ? 'min-h-40' : 'min-h-56'"
		>
			<div class="pointer-events-none absolute inset-1/4 rounded-full bg-primary/10 blur-3xl" />
			<DonutChart
				:data="chartValues"
				:categories="categories"
				:radius="chartRadius"
				:height="chartHeight"
				:arc-width="arcWidth"
				:pad-angle="0.035"
				:type="half ? DonutType.Half : DonutType.Full"
				:duration="chartDuration"
				:tooltip="tooltipOptions"
				hide-legend
			>
				<div
					class="flex flex-col items-center text-center"
					:class="compact ? 'max-w-24' : 'max-w-32'"
				>
					<span
						class="font-black tabular-nums leading-tight text-highlighted"
						:class="{
							'text-lg': !compact && !half,
							'text-lg pt-12': !compact && half,
							'text-sm': compact && !half,
							'text-sm pt-12': compact && half,
						}"
					>
						{{ totalLabel }}
					</span>
				</div>
				<template #tooltip="{ values }">
					<DashboardChartTooltip
						:entries="resolveTooltipEntries(values)"
						:total="total"
					/>
				</template>
			</DonutChart>
		</div>
		<DashboardChartLegend :entries="entries" :total="total" :ariaLabel="ariaLabel" :compact="compact" />
	</div>
</template>

<script setup vapor lang="ts">
import type { DashboardChartEntry } from '~/types/app'

const props = withDefaults(
	defineProps<{
		entries: DashboardChartEntry[]
		totalLabel: string
		ariaLabel: string
		half?: boolean
		compact?: boolean
	}>(),
	{ half: false, compact: false },
)

const reducedMotion = ref(false)
onMounted(() => {
	reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

const layoutClass = computed(() =>
	props.compact
		? 'grid items-center gap-3 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(8rem,1.2fr)]'
		: 'grid items-center gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(13rem,1.05fr)]',
)
const chartHeight = computed(() => (props.compact ? 160 : 224))
const chartRadius = computed(() => (props.compact ? (props.half ? 70 : 62) : props.half ? 96 : 88))
const arcWidth = computed(() => (props.compact ? (props.half ? 26 : 22) : props.half ? 34 : 30))
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
