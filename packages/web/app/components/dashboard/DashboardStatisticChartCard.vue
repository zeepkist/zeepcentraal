<template>
	<UCard
		class="group h-full overflow-hidden rounded-2xl border-border bg-gradient-to-br from-card via-card to-primary/5 transition hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
	>
		<template #header>
			<div class="flex items-start justify-between gap-4">
				<div>
					<h3 class="font-bold text-highlighted">{{ title }}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
				</div>
				<TablerIcon :name="icon" class="size-5 shrink-0 text-primary" />
			</div>
		</template>

		<div v-if="total > 0" class="space-y-4">
			<div class="min-h-60">
				<DonutChart
					v-if="kind === 'donut'"
					:data="chartValues"
					:categories="categories"
					:radius="half ? 92 : 86"
					:height="240"
					:arc-width="half ? 28 : 24"
					:pad-angle="0.025"
					:type="half ? 'half' : 'full'"
					:duration="chartDuration"
					hide-legend
				/>
				<BarChart
					v-else
					:data="barData"
					:categories="barCategories"
					:y-axis="['value']"
					:height="240"
					:x-formatter="xFormatter"
					:y-formatter="yFormatter"
					:duration="chartDuration"
					:radius="6"
					:bar-padding="0.18"
					hide-legend
					x-grid-line
				/>
			</div>
			<ul class="grid gap-2 sm:grid-cols-2" :aria-label="title">
				<li
					v-for="entry in entries"
					:key="entry.key"
					class="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
				>
					<span class="flex min-w-0 items-center gap-2 text-muted-foreground">
						<span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: entry.color }" />
						<span class="truncate">{{ entry.label }}</span>
					</span>
					<span class="shrink-0 font-semibold tabular-nums text-highlighted">
						{{ entry.formattedValue }}
					</span>
				</li>
			</ul>
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
		half?: boolean
	}>(),
	{ half: false },
)

const reducedMotion = ref(false)
onMounted(() => {
	reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

const chartDuration = computed(() => (reducedMotion.value ? 0 : 650))
const total = computed(() => props.entries.reduce((sum, entry) => sum + entry.value, 0))
const chartValues = computed(() => props.entries.map((entry) => entry.value))
const categories = computed(() =>
	Object.fromEntries(
		props.entries.map((entry) => [entry.key, { name: entry.label, color: entry.color }]),
	),
)
const barData = computed(() =>
	props.entries.map((entry) => ({ label: entry.label, value: entry.value })),
)
const barCategories = computed(() => ({
	value: { name: props.title, color: '#facc15' },
}))
const xFormatter = (_value: number | Date, index: number) => props.entries[index]?.label ?? ''
const compactNumber = new Intl.NumberFormat(undefined, {
	notation: 'compact',
	maximumFractionDigits: 1,
})
const yFormatter = (value: number | Date) =>
	typeof value === 'number' ? compactNumber.format(value) : String(value)
</script>
