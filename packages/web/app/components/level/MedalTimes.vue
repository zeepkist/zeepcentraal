<template>
	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
		<div v-for="medal in medals" :key="medal.key" class="rounded-xl border border-border bg-card/70 p-4 flex items-center gap-4">
			<NuxtImg
				:src="medal.src"
				:alt="`${medal.label} medal`"
				format="avif"
				width="48"
				height="48"
				densities="1x 2x"
				class="h-12 w-12 object-contain"
			/>
			<div>
				<p class="text-sm text-muted-foreground">{{ medal.label }}</p>
				<p class="mt-1 text-xl font-bold tabular-nums">{{ medal.time == null ? t(times.dueAt ? 'medals.settling' : 'medals.unavailable') : formatTime(medal.time) }}</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { MedalTimes } from '~/types/app'
import { MEDALS } from '~/utils/medals'

const props = defineProps<{
	times: MedalTimes
	labels: { author: string; gold: string; silver: string; bronze: string }
}>()

const { t } = useAppI18n()
const medals = computed(() => MEDALS.map(medal => ({
	...medal,
	label: medal.key === 'expert' || medal.key === 'apex' ? t(medal.labelKey) : props.labels[medal.key],
	time: props.times[medal.key],
})))

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
