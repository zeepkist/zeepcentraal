<template>
	<div
		class="grid gap-4 sm:grid-cols-2"
		:class="{
			'xl:grid-cols-3 2xl:grid-cols-4': columns === 4,
			'xl:grid-cols-3': columns === 3,
		}"
	>
		<LevelCard
			v-for="level in levels"
			:key="level.id"
			:level="level"
			:adventure-label="adventureLabel"
			:points-label="pointsLabel"
			:records-label="recordsLabel"
			:personal-bests-label="personalBestsLabel"
			:rating-label="ratingLabel"
			:unavailable-label="unavailableLabel"
			:world-record-label="worldRecordLabel"
			:author-time-label="authorTimeLabel"
			:by-label="byLabel"
			:created-label="createdLabel"
		/>
	</div>
</template>

<script setup lang="ts">
import type { LevelSummary } from '~/types/app'

withDefaults(
	defineProps<{
		levels: LevelSummary[]
		adventureLabel: string
		pointsLabel: string
		recordsLabel: string
		personalBestsLabel: string
		ratingLabel: string
		unavailableLabel: string
		worldRecordLabel?: string
		authorTimeLabel?: string
		byLabel?: string
		createdLabel?: string
		columns?: 2 | 3 | 4
	}>(),
	{ columns: 3 },
)
</script>
