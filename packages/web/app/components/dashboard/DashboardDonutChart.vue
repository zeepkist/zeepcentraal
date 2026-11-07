<template>
	<div :class="layoutClass">
		<div
			class="telemetry-donut relative overflow-hidden rounded-xl from-primary/5 via-transparent to-secondary/5"
			:class="compact ? 'min-h-40' : 'min-h-56'"
			@pointermove.passive="moveTooltip"
			@pointerdown.passive="moveTooltip"
			@pointerleave="hover = null"
		>
			<div class="pointer-events-none absolute inset-1/4 rounded-full bg-primary/10 blur-3xl" />
			<DonutChart
				:data="chartValues"
				:categories="categories"
				:radius="chartRadius"
				:height="chartHeight"
				:arc-width="arcWidth"
				:pad-angle="padAngle"
				:type="donutType"
				:duration="chartDuration"
				stroke="none"
				hide-tooltip
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
			</DonutChart>
			<Teleport to="body">
				<div v-if="hover && hoveredEntry" role="tooltip" class="pointer-events-none fixed z-50"
					:style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
					<DashboardChartTooltip :entries="[hoveredEntry]" :total="total" />
				</div>
			</Teleport>
		</div>
		<DashboardChartLegend :entries="entries" :total="total" :ariaLabel="ariaLabel" :compact="compact" />
	</div>
</template>

<script setup lang="ts">
import type { DonutType } from '#imports'
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

const layoutClass = computed(() =>
	props.compact
		? 'grid items-center gap-3 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(8rem,1.2fr)]'
		: 'grid items-center gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(13rem,1.05fr)]',
)
const chartHeight = computed(() => (props.compact ? 160 : 224))
const chartRadius = computed(() => (props.compact ? (props.half ? 70 : 62) : props.half ? 96 : 88))
const arcWidth = computed(() => (props.compact ? (props.half ? 26 : 22) : props.half ? 34 : 30))
const donutType = computed(() => (props.half ? 'half' : 'full') as DonutType)
const chartDuration = useMotionDuration(650)
// v3's renderer measures sector padding in degrees, rather than radians.
const padAngle = 0.035 * 180 / Math.PI
const hover = shallowRef<{ x: number; y: number; key: string } | null>(null)
const hoveredEntry = computed(() => props.entries.find((entry) => entry.key === hover.value?.key))
const total = computed(() => props.entries.reduce((sum, entry) => sum + entry.value, 0))
const chartValues = computed(() => props.entries.map((entry) => entry.value))
const categories = computed(() =>
	Object.fromEntries(
		props.entries.map((entry) => [entry.key, { name: entry.label, color: entry.color }]),
	),
)

// v3's DonutChart exposes only its center slot; keep the shared tooltip in this wrapper.
function moveTooltip(event: PointerEvent) {
	const target = event.target
	if (!(target instanceof SVGPathElement) || !target.matches('.v-charts-sector')) {
		hover.value = null
		return
	}
	const container = event.currentTarget as HTMLElement
	const sectors = Array.from(container.querySelectorAll('.v-charts-sector'))
	const entry = props.entries.filter((entry) => entry.value > 0)[sectors.indexOf(target)]
	if (!entry) {
		hover.value = null
		return
	}
	hover.value = {
		x: Math.max(16, Math.min(event.clientX + 12, window.innerWidth - 256)),
		y: Math.max(16, Math.min(event.clientY + 12, window.innerHeight - 112)),
		key: entry.key,
	}
}
watch(() => props.entries, () => { hover.value = null })
</script>
