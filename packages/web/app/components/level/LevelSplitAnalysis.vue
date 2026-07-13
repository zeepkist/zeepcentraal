<template>
	<div class="space-y-4">
		<div class="flex flex-wrap gap-2">
			<NuxtLink
				v-for="player in analysis.series"
				:key="player.recordId"
				:to="player.userSteamId ? `/user/${player.userSteamId}` : `/record/${player.recordId}`"
				class="flex items-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2 transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<span class="size-2 rounded-full" :style="{ backgroundColor: player.color }" />
				<span class="text-sm font-semibold text-highlighted">{{ player.userName }}</span>
				<span class="font-mono text-xs tabular-nums text-muted-foreground">
					{{ formatTime(player.time) }}
				</span>
			</NuxtLink>
		</div>

		<div class="grid gap-4 xl:grid-cols-2">
			<UCard
				class="overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-primary/5"
				:ui="compactCardUi"
			>
				<template #header>
					<h3 class="font-bold text-highlighted">{{ labels.deltaTitle }}</h3>
					<p class="mt-1 text-xs text-muted-foreground">{{ labels.deltaDescription }}</p>
				</template>
				<LineChart
					:data="analysis.deltaData"
					:categories="categories"
					:y-axis="seriesKeys"
					:height="220"
					:x-formatter="formatCheckpoint"
					:line-width="3"
					:duration="chartDuration"
					:hide-legend="true"
					:tooltip="tooltipOptions"
				>
					<template #tooltip="{ values }">
						<DashboardChartTooltip
							:entries="resolveTooltipEntries(values, 'delta')"
							:title="resolveTooltipTitle(values)"
							:show-percentage="false"
						/>
					</template>
				</LineChart>
			</UCard>

			<UCard
				class="overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-primary/5"
				:ui="compactCardUi"
			>
				<template #header>
					<h3 class="font-bold text-highlighted">{{ labels.speedTitle }}</h3>
					<p class="mt-1 text-xs text-muted-foreground">{{ labels.speedDescription }}</p>
				</template>
				<LineChart
					:data="analysis.speedData"
					:categories="categories"
					:y-axis="seriesKeys"
					:height="220"
					:x-formatter="formatCheckpoint"
					:line-width="3"
					:duration="chartDuration"
					:hide-legend="true"
					:tooltip="tooltipOptions"
				>
					<template #tooltip="{ values }">
						<DashboardChartTooltip
							:entries="resolveTooltipEntries(values, 'speed')"
							:title="resolveTooltipTitle(values)"
							:show-percentage="false"
						/>
					</template>
				</LineChart>
			</UCard>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import type { LevelSplitAnalysis } from '~/utils/levelSplitAnalysis'

const props = defineProps<{
	analysis: LevelSplitAnalysis
	labels: {
		checkpoint: string
		deltaTitle: string
		deltaDescription: string
		speedTitle: string
		speedDescription: string
		secondsUnit: string
		speedUnit: string
	}
}>()

const { locale } = useI18n()
const deltaFormat = computed(
	() => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
)
const speedFormat = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
)
const categories = computed(() =>
	Object.fromEntries(
		props.analysis.series.map((player) => [
			player.key,
			{ name: player.userName, color: player.color },
		]),
	),
)
const seriesKeys = computed(() => props.analysis.series.map((player) => player.key))
const compactCardUi = { header: 'p-4 sm:p-4', body: 'p-3 sm:p-4' }
const chartDuration = ref(0)
const tooltipOptions = { followCursor: true, showDelay: 80, hideDelay: 40 }
onMounted(() => {
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) chartDuration.value = 500
})

function formatCheckpoint(index: number) {
	return `${props.labels.checkpoint} ${index + 1}`
}

function resolveTooltipTitle(values: unknown) {
	if (!values || typeof values !== 'object') return ''
	const checkpoint = (values as Record<string, unknown>).checkpoint
	return typeof checkpoint === 'number'
		? `${props.labels.checkpoint} ${checkpoint}`
		: ''
}

function resolveTooltipEntries(
	values: unknown,
	mode: 'delta' | 'speed',
): DashboardChartEntry[] {
	if (!values || typeof values !== 'object') return []
	const datum = values as Record<string, unknown>
	return props.analysis.series.flatMap((player) => {
		const value = datum[player.key]
		if (typeof value !== 'number') return []
		const formattedValue =
			mode === 'delta'
				? `${value > 0 ? '+' : ''}${deltaFormat.value.format(value)} ${props.labels.secondsUnit}`
				: `${speedFormat.value.format(value)} ${props.labels.speedUnit}`
		return [{
			key: player.key,
			label: player.userName,
			value,
			color: player.color,
			formattedValue,
		}]
	})
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
