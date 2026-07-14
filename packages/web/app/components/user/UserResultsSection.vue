<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="title" :description="description">
			<div v-if="sort && sortOptions?.length" class="flex min-w-0 items-center gap-2">
				<span class="shrink-0 text-sm font-medium text-muted-foreground">
					{{ sortLabel }}
				</span>
				<USelect
					:id="`${id}-sort`"
					:model-value="sort"
					:items="sortOptions"
					icon="i-tabler-arrows-sort"
					class="w-48"
					:aria-label="sortLabel"
					@update:model-value="$emit('update:sort', String($event) as 'valuable' | 'recent')"
				/>
			</div>
		</SectionHeader>
		<DataState
			:pending="pending && records.length === 0"
			:error="error"
			:empty="records.length === 0"
			:loading-label="paginationLabels.loadingLabel"
			:error-title="labels.error"
			:empty-title="labels.empty"
		>
			<RecordTable
				:records="records"
				:rank-label="labels.rank"
				:user-label="labels.user"
				:level-label="labels.level"
				:time-label="labels.time"
				:date-label="labels.date"
				:points-label="labels.points"
				:pb-or-wr-label="labels.pbOrWr"
				:personal-best-label="labels.personalBest"
				:world-record-label="labels.worldRecord"
				:show-rank="showRank"
				:show-points="showPoints"
				:show-pb-or-wr="showPbOrWr"
				:show-user="false"
				show-level
			/>
		</DataState>
		<CursorPagination
			v-if="records.length > 0"
			class="mt-4"
			:page="page"
			:can-go-previous="canGoPrevious"
			:can-go-next="canGoNext"
			:pending="pending"
			v-bind="paginationLabels"
			@first="$emit('first')"
			@previous="$emit('previous')"
			@next="$emit('next')"
			@last="$emit('last')"
		/>
	</section>
</template>

<script setup lang="ts">
import type { CursorPage, RecordRow, SortOption } from '~/types/app'

withDefaults(
	defineProps<{
		id: string
		title: string
		description: string
		records: RecordRow[]
		sort?: 'valuable' | 'recent'
		sortLabel?: string
		pending: boolean
		error?: string | null
		page: CursorPage
		canGoPrevious: boolean
		canGoNext: boolean
		showRank?: boolean
		showPoints?: boolean
		showPbOrWr?: boolean
		labels: {
			rank: string
			user: string
			level: string
			time: string
			points: string
			pbOrWr: string
			personalBest: string
			worldRecord: string
			date: string
			error: string
			empty: string
		}
		sortOptions?: SortOption[]
		paginationLabels: {
			label: string
			loadingLabel: string
			firstLabel: string
			previousLabel: string
			nextLabel: string
			lastLabel: string
		}
	}>(),
	{ showRank: true },
)
defineEmits<{
	'update:sort': [value: 'valuable' | 'recent']
	first: []
	previous: []
	next: []
	last: []
}>()
</script>
