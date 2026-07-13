<template>
	<div class="space-y-5">
		<div class="flex flex-wrap gap-3">
			<NuxtLink
				v-for="player in analysis.series"
				:key="player.recordId"
				:to="player.userSteamId ? `/user/${player.userSteamId}` : `/record/${player.recordId}`"
				class="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<span class="size-2.5 rounded-full" :style="{ backgroundColor: player.color }" />
				<span class="font-semibold text-highlighted">{{ player.userName }}</span>
				<span class="font-mono text-sm tabular-nums text-muted-foreground">
					{{ formatTime(player.time) }}
				</span>
			</NuxtLink>
		</div>

		<div class="grid gap-5 xl:grid-cols-2">
			<UCard class="overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-primary/5">
				<template #header>
					<h3 class="font-bold text-highlighted">{{ labels.deltaTitle }}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ labels.deltaDescription }}</p>
				</template>
				<LineChart
					:data="analysis.deltaData"
					:categories="categories"
					:y-axis="seriesKeys"
					:height="320"
					:x-formatter="formatCheckpoint"
					:line-width="3"
					:duration="chartDuration"
					:hide-legend="true"
				/>
			</UCard>

			<UCard class="overflow-hidden rounded-2xl border-border/80 bg-gradient-to-br from-card to-primary/5">
				<template #header>
					<h3 class="font-bold text-highlighted">{{ labels.speedTitle }}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ labels.speedDescription }}</p>
				</template>
				<LineChart
					:data="analysis.speedData"
					:categories="categories"
					:y-axis="seriesKeys"
					:height="320"
					:x-formatter="formatCheckpoint"
					:line-width="3"
					:duration="chartDuration"
					:hide-legend="true"
				/>
			</UCard>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { LevelSplitAnalysis } from '~/utils/levelSplitAnalysis'

const props = defineProps<{
	analysis: LevelSplitAnalysis
	labels: {
		checkpoint: string
		deltaTitle: string
		deltaDescription: string
		speedTitle: string
		speedDescription: string
	}
}>()

const categories = computed(() =>
	Object.fromEntries(
		props.analysis.series.map((player) => [
			player.key,
			{ name: player.userName, color: player.color },
		]),
	),
)
const seriesKeys = computed(() => props.analysis.series.map((player) => player.key))
const chartDuration = ref(0)
onMounted(() => {
	if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) chartDuration.value = 500
})

function formatCheckpoint(index: number) {
	return `${props.labels.checkpoint} ${index + 1}`
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
