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
			<div v-if="kind === 'donut'" class="grid items-center gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(13rem,1.05fr)]">
				<div class="relative min-h-56 overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-secondary/5">
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
								:entry="resolveTooltipEntry(values)"
								:percentage="formatPercentage(resolveTooltipEntry(values))"
							/>
						</template>
					</DonutChart>
				</div>
				<DashboardChartLegend :entries="entries" :total="total" :aria-label="title" />
			</div>

			<div v-else class="space-y-5">
				<div class="rounded-xl bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 px-2 py-3 sm:px-4">
					<BarChart
						:data="barData"
						:categories="barCategories"
						:y-axis="['value']"
						:height="barHeight"
						orientation="horizontal"
						:x-formatter="valueAxisFormatter"
						:y-formatter="categoryAxisFormatter"
						:duration="chartDuration"
						:radius="10"
						:bar-padding="0.3"
						:padding="{ top: 8, right: 12, bottom: 8, left: 8 }"
						:tooltip="tooltipOptions"
						hide-legend
						x-grid-line
					>
						<template #tooltip="{ values }">
							<DashboardChartTooltip
								:entry="resolveTooltipEntry(values)"
								:percentage="formatPercentage(resolveTooltipEntry(values))"
							/>
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

const { locale } = useI18n()
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
const barData = computed(() =>
	props.entries.map((entry) => ({ key: entry.key, label: entry.label, value: entry.value })),
)
const barCategories = computed(() => ({
	value: { name: props.title, color: ['#facc15', '#f59e0b'] },
}))
const barHeight = computed(() => Math.max(220, props.entries.length * 48))
const compactNumber = computed(
	() =>
		new Intl.NumberFormat(locale.value, {
			notation: 'compact',
			maximumFractionDigits: 1,
		}),
)
const percentageFormat = computed(
	() =>
		new Intl.NumberFormat(locale.value, {
			style: 'percent',
			maximumFractionDigits: 1,
		}),
)
const valueAxisFormatter = (value: number | Date) =>
	typeof value === 'number' ? compactNumber.value.format(value) : String(value)
const categoryAxisFormatter = (_value: number | Date, index?: number) =>
	props.entries[index ?? -1]?.label ?? ''

function resolveTooltipEntry(values: unknown): DashboardChartEntry | undefined {
	if (!values || typeof values !== 'object') return undefined
	const datum = values as Record<string, unknown>
	const label = typeof datum.label === 'string' ? datum.label : undefined
	const key = typeof datum.key === 'string' ? datum.key : undefined
	const index = typeof datum._index === 'number' ? datum._index : undefined
	return (
		props.entries.find((entry) => entry.key === key || entry.label === label) ??
		(index === undefined ? undefined : props.entries[index])
	)
}

function formatPercentage(entry?: DashboardChartEntry) {
	return percentageFormat.value.format(entry && total.value > 0 ? entry.value / total.value : 0)
}
</script>
