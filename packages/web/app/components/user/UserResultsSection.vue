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
					@update:model-value="$emit('update:sort', String($event) as RecordHistorySort)"
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
			<RecordHistoryTable
				:records="records"
				:labels="labels"
				:status-mode="statusMode"
				live-update-label=""
				rank-first
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

<script setup vapor lang="ts">
import type { CursorPage, RecordHistoryRow, SortOption } from '~/types/app'
import type { RecordHistorySort } from '~/utils/recordHistory'

withDefaults(
	defineProps<{
		id: string
		title: string
		description: string
		records: RecordHistoryRow[]
		sort?: RecordHistorySort
		sortLabel?: string
		pending: boolean
		error?: string | null
		page: CursorPage
		canGoPrevious: boolean
		canGoNext: boolean
		statusMode?: 'none' | 'world-record-only' | 'all'
		labels: {
			rank: string
			level: string
			player: string
			unknownPlayer: string
			time: string
			status: string
			points: string
			pointsHelp: string
			rankedPoints: string
			rankedPointsHelp: string
			levelPoints: string
			personalBest: string
			worldRecord: string
			openRecord: string
			date: string
			notRanked: string
			decayPercentage: string
			error: string
			empty: string
		}
		sortOptions?: SortOption<RecordHistorySort>[]
		paginationLabels: {
			label: string
			loadingLabel: string
			firstLabel: string
			previousLabel: string
			nextLabel: string
			lastLabel: string
		}
	}>(),
	{},
)
defineEmits<{
	'update:sort': [value: RecordHistorySort]
	first: []
	previous: []
	next: []
	last: []
}>()
</script>
