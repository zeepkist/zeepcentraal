<template>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<LevelCard
			v-for="level in levels"
			:key="level.id"
			:level="level"
			:adventure-label="adventureLabel"
			:points-label="pointsLabel"
			:records-label="recordsLabel"
			:personal-bests-label="personalBestsLabel"
			:world-record-label="worldRecordLabel"
			:author-time-label="authorTimeLabel"
			:by-label="byLabel"
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
	personalBestsLabel?: string
	worldRecordLabel?: string
	authorTimeLabel?: string
	byLabel?: string
}>()
</script>
