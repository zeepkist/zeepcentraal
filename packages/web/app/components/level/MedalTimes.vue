<template>
	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<div v-for="medal in medals" :key="medal.key" class="rounded-xl border border-border bg-card/70 p-4">
			<p class="text-sm text-muted-foreground">{{ medal.label }}</p>
			<p class="mt-1 text-xl font-bold tabular-nums">{{ formatTime(medal.time) }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { MedalTimes } from '~/types/app'

const props = defineProps<{
	times: MedalTimes
	labels: { author: string; gold: string; silver: string; bronze: string }
}>()
const medals = computed(() => [
	{ key: 'author', label: props.labels.author, time: props.times.author },
	{ key: 'gold', label: props.labels.gold, time: props.times.gold },
	{ key: 'silver', label: props.labels.silver, time: props.times.silver },
	{ key: 'bronze', label: props.labels.bronze, time: props.times.bronze },
])
function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
