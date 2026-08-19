<script setup vapor lang="ts">
import type { CursorPage, LevelSummary } from '~/types/app'

defineProps<{
	id: string
	title: string
	description: string
	levels: LevelSummary[]
	pending: boolean
	paginationPending: boolean
	error?: string
	page: CursorPage
	canGoPrevious: boolean
	canGoNext: boolean
	transitionScope: string
	labels: {
		loading: string
		error: string
		empty: string
		adventure: string
		points: string
		records: string
		personalBests: string
		rating: string
		unavailable: string
		worldRecord: string
		authorTime: string
		by: string
		created: string
		pagination: string
		first: string
		previous: string
		next: string
		last: string
	}
}>()

defineEmits<{ first: []; previous: []; next: []; last: [] }>()
</script>

<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="title" :description="description" />
		<DataState
			:pending="pending"
			:error="error"
			:empty="levels.length === 0"
			:loading-label="labels.loading"
			:error-title="labels.error"
			:empty-title="labels.empty"
		>
			<template #pending>
				<LevelGridSkeleton :columns="3" />
			</template>
			<LevelGrid
				:levels="levels"
				:adventure-label="labels.adventure"
				:points-label="labels.points"
				:records-label="labels.records"
				:personal-bests-label="labels.personalBests"
				:rating-label="labels.rating"
				:unavailable-label="labels.unavailable"
				:world-record-label="labels.worldRecord"
				:author-time-label="labels.authorTime"
				:by-label="labels.by"
				:created-label="labels.created"
				:transition-scope="transitionScope"
				:columns="3"
			/>
		</DataState>
		<CursorPagination
			class="mt-4"
			:page="page"
			:can-go-previous="canGoPrevious"
			:can-go-next="canGoNext"
			:pending="paginationPending"
			:label="labels.pagination"
			:loading-label="labels.loading"
			:first-label="labels.first"
			:previous-label="labels.previous"
			:next-label="labels.next"
			:last-label="labels.last"
			@first="$emit('first')"
			@previous="$emit('previous')"
			@next="$emit('next')"
			@last="$emit('last')"
		/>
	</section>
</template>
