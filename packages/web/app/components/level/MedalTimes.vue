<template>
	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		<div v-for="medal in medals" :key="medal.key" class="rounded-xl border border-border bg-card/70 p-4 flex items-center gap-4">
			<NuxtImg
				:src="medal.src"
				:alt="`${medal.label} medal`"
				format="avif"
				width="48"
				height="48"
				densities="1x 2x"
				class="h-12 w-12 rounded-full"
			/>
			<div>
				<p class="text-sm text-muted-foreground">{{ medal.label }}</p>
				<p class="mt-1 text-xl font-bold tabular-nums">{{ formatTime(medal.time) }}</p>
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import MED_Author from '~/assets/medals/MED_Author.png'
import MED_Bronze from '~/assets/medals/MED_Bronze.png'
import MED_Gold from '~/assets/medals/MED_Gold2.png'
import MED_Silver from '~/assets/medals/MED_Silver.png'
import type { MedalTimes } from '~/types/app'

const props = defineProps<{
	times: MedalTimes
	labels: { author: string; gold: string; silver: string; bronze: string }
}>()

const medals = computed(() => [
	{ key: 'author', label: props.labels.author, time: props.times.author, src: MED_Author },
	{ key: 'gold', label: props.labels.gold, time: props.times.gold, src: MED_Gold },
	{ key: 'silver', label: props.labels.silver, time: props.times.silver, src: MED_Silver },
	{ key: 'bronze', label: props.labels.bronze, time: props.times.bronze, src: MED_Bronze },
])

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
