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
				class="h-12 w-12 shrink-0 object-contain"
			/>
			<div class="min-w-0">
				<p class="text-sm text-muted-foreground">{{ medal.label }}</p>
				<p class="mt-1 text-xl font-bold tabular-nums">{{ medal.time == null ? pendingLabel : formatTime(medal.time) }}</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { useRecordDateNow } from '~/composables/useRecordDateNow'
import type { MedalTimes } from '~/types/app'
import { formatMedalSettlementDuration, MEDALS } from '~/utils/medals'

const props = defineProps<{
	times: MedalTimes
	labels: { author: string; gold: string; silver: string; bronze: string }
}>()

const { t } = useAppI18n()
const clock = useRecordDateNow()
const mounted = useMounted()
// Serialize the server timestamp so the first client render matches SSR across minute boundaries.
const initialNow = useState('medal-status-now', () => Date.now())
const pendingLabel = computed(() => {
	if (!props.times.dueAt) {
		const count = Math.max(0, 10 - (props.times.eligiblePbCount ?? 0))
		return t('medals.authorMedalsToUnlock', { count }, count)
	}
	const now = mounted.value ? clock.value.getTime() : initialNow.value
	const remaining = Date.parse(props.times.dueAt) - now
	return remaining > 0
		? t('medals.settlesIn', { duration: formatMedalSettlementDuration(remaining) })
		: t('medals.calculating')
})
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
