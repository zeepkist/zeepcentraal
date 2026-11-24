<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="title" :description="description">
			<div
				v-if="(sort && sortOptions?.length) || medal !== undefined"
				class="flex max-w-full flex-wrap items-center gap-3"
			>
				<div v-if="sort && sortOptions?.length" class="flex max-w-full items-center gap-2">
					<span class="shrink-0 text-sm font-medium text-muted-foreground">
						{{ sortLabel }}
					</span>
					<USelect
						:id="`${id}-sort`"
						:model-value="sort"
						:items="sortOptions"
						icon="i-tabler-arrows-sort"
						class="w-48 min-w-0"
						:aria-label="sortLabel"
						@update:model-value="$emit('update:sort', String($event) as RecordHistorySort)"
					/>
				</div>
				<div v-if="medal !== undefined" class="flex max-w-full items-center gap-2">
					<span class="shrink-0 text-sm font-medium text-muted-foreground">
						{{ t('medals.column') }}
					</span>
					<USelect
						:id="`${id}-medal`"
						:model-value="medal"
						:items="medalOptions"
						:icon="IconAward"
						class="w-36 min-w-0"
						:aria-label="t('medals.column')"
						@update:model-value="$emit('update:medal', normalizeMedalFilter($event))"
					/>
				</div>
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
				:supporters="supporters"
				:labels="labels"
				:status-mode="statusMode"
				:transition-scope="transitionScope"
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

<script setup lang="ts">
import IconAward from '@tabler/icons-vue/dist/esm/icons/IconAward.mjs'
import type { CursorPage, RecordHistoryRow, SortOption } from '~/types/app'
import { MEDALS, type MedalFilter, normalizeMedalFilter } from '~/utils/medals'
import type { RecordHistorySort } from '~/utils/recordHistory'
import type { SupporterMap } from '~/utils/supporters'

withDefaults(
	defineProps<{
		id: string
		title: string
		description: string
		records: RecordHistoryRow[]
		supporters?: SupporterMap
		transitionScope: string
		sort?: RecordHistorySort
		sortLabel?: string
		medal?: MedalFilter
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
			delta: string
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
	'update:medal': [value: MedalFilter]
	'update:sort': [value: RecordHistorySort]
	first: []
	previous: []
	next: []
	last: []
}>()

const { t } = useI18n()
const medalOptions = computed<SortOption<MedalFilter>[]>(() => [
	{ value: 'all', label: t('users.profile.medalFilter.all') },
	...MEDALS.map(({ key, labelKey }) => ({
		value: key,
		label: t('users.profile.medalFilter.tier', { medal: t(labelKey) }),
	})),
	{ value: 'none', label: t('users.profile.medalFilter.none') },
])
</script>
