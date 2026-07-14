<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="title" :description="description">
			<UButton :to="actionTo" color="neutral" variant="soft" trailing-icon="i-tabler-arrow-right">
				{{ actionLabel }}
			</UButton>
		</SectionHeader>
		<DataState
			:pending="pending"
			:error="error"
			:empty="levels.length === 0"
			:loading-label="labels.loading"
			:error-title="labels.error"
			:empty-title="labels.empty"
		>
			<LevelGrid
				:levels="levels"
				:adventure-label="labels.adventure"
				:points-label="labels.points"
				:records-label="recordsLabel"
				:personal-bests-label="labels.personalBests"
				:world-record-label="labels.worldRecord"
				:author-time-label="labels.authorTime"
				:by-label="labels.by"
				:created-label="labels.created"
				:columns="columns"
			/>
		</DataState>
	</section>
</template>

<script setup lang="ts">
import type { LevelSummary } from '~/types/app'

withDefaults(defineProps<{
	id: string
	title: string
	description: string
	actionLabel: string
	actionTo: string
	recordsLabel: string
	levels: LevelSummary[]
	pending: boolean
	error?: string
	labels: {
		loading: string
		error: string
		empty: string
		adventure: string
		points: string
		personalBests: string
		worldRecord: string
		authorTime: string
		by: string
		created: string
	}
	columns?: 2 | 3 | 4
}>(), { columns: 3 })
</script>
