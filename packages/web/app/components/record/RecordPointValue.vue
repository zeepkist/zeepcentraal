<template>
	<UTooltip
		v-if="points != null && decayMultiplier != null"
		:text="
			decayLabel.replace('{percentage}', precisePercentage.format(decayMultiplier))
		"
	>
		<div class="w-full px-4 py-3 tabular-nums" tabindex="0" @keydown.stop>
			<span class="font-bold">{{ number.format(points) }}</span>
			<span
				class="text-xs text-muted-foreground/70 ml-1"
				:aria-label="decayLabel.replace('{percentage}', percentage.format(decayMultiplier))"
			>
				({{ percentage.format(decayMultiplier) }})
			</span>
		</div>
	</UTooltip>
	<div v-else-if="points != null" class="w-full px-4 py-3 font-bold tabular-nums">
		{{ number.format(points) }}
	</div>
	<div v-else class="w-full px-4 py-3 text-muted-foreground">
		{{ notRankedLabel }}
	</div>
</template>

<script setup lang="ts">
import { createDecayPercentageFormatter } from '~/utils/decayPercentage'

defineProps<{
	points?: number | null
	decayMultiplier?: number | null
	notRankedLabel: string
	decayLabel: string
}>()

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const percentage = computed(() => createDecayPercentageFormatter(locale.value))
const precisePercentage = computed(() => createDecayPercentageFormatter(locale.value, 3, 3))
</script>
