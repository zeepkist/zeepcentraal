<script setup vapor lang="ts">
import type { LevelSummary } from '~/types/app'

defineProps<{
	levels: LevelSummary[]
	selected: number[]
	ownLevels: Set<number>
	maxPicks: number
}>()
const emit = defineEmits<{ toggle: [levelId: number] }>()
</script>

<template>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<LevelCard v-for="level in levels" :key="level.id" :level="level" transition-scope="zsl-vote"
			adventure-label="Adventure" points-label="Points" records-label="Records"
			personal-bests-label="Personal bests" rating-label="Rating" unavailable-label="—">
			<template #actions>
				<UButton :variant="selected.includes(level.id) ? 'solid' : 'outline'" block
					:disabled="ownLevels.has(level.id) || (!selected.includes(level.id) && selected.length >= maxPicks)"
					:aria-pressed="selected.includes(level.id)" @click="emit('toggle', level.id)">
					{{ ownLevels.has(level.id) ? 'Your level' : selected.includes(level.id) ? 'Selected' : 'Vote for level' }}
				</UButton>
			</template>
		</LevelCard>
	</div>
</template>
