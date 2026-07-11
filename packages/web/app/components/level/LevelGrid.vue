<template>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<LevelCard
			v-for="level in levels"
			:key="level.id"
			:level="level"
			:adventure-label="adventureLabel"
			:points-label="pointsLabel"
			:records-label="recordsLabel"
		/>
	</div>
</template>

<script setup lang="ts">
import type { LevelSummary } from '~/types/app'

defineProps<{
	levels: LevelSummary[]
	adventureLabel: string
	pointsLabel: string
	recordsLabel: string
}>()
</script>
