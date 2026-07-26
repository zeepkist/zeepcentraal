<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<div class="mb-4 flex items-start justify-between gap-3">
			<div class="flex items-center gap-2">
				<TablerIcon name="adjustments" class="text-primary" />
				<h2 class="font-semibold">{{ title }}</h2>
			</div>
			<UBadge color="neutral" variant="soft" class="shrink-0">{{ resultCountLabel }}</UBadge>
		</div>
		<div class="grid gap-4">
			<UFormField :label="searchLabel">
				<UInput :model-value="search" class="w-full" @update:model-value="$emit('update:search', String($event))">
					<template #leading><TablerIcon name="search" class="size-4 text-muted-foreground" /></template>
				</UInput>
			</UFormField>
			<UFormField :label="authorLabel">
				<UInputMenu
					:model-value="author"
					:items="authorSuggestions"
					:loading="authorSuggestionsPending"
					:placeholder="authorLabel"
					class="w-full"
					mode="autocomplete"
					value-key="value"
					ignore-filter
					clear
					@update:model-value="$emit('update:author', String($event ?? ''))"
				/>
			</UFormField>
			<UFormField :label="adventureLabel">
				<USelect :model-value="adventure" :items="adventureOptions" class="w-full" @update:model-value="$emit('update:adventure', String($event) as LevelTypeFilter)" />
			</UFormField>
			<UFormField>
				<template #label>
					<div class="flex w-full items-center justify-between gap-3">
						<span>{{ pointsLabel }}</span>
						<span class="text-xs tabular-nums text-muted-foreground">{{ formatRange(points) }}</span>
					</div>
				</template>
				<USlider
					:model-value="points"
					:min="pointsMinimum"
					:max="pointsMaximum"
					:step="1"
					:min-steps-between-thumbs="1"
					tooltip
					@update:model-value="$emit('update:points', $event as [number, number])"
				/>
			</UFormField>
			<UFormField>
				<template #label>
					<div class="flex w-full items-center justify-between gap-3">
						<span>{{ ratingLabel }}</span>
						<span class="text-xs tabular-nums text-muted-foreground">{{ formatRatingRange(rating) }}</span>
					</div>
				</template>
				<USlider
					:model-value="rating"
					:min="ratingMinimum"
					:max="ratingMaximum"
					:step="1"
					:min-steps-between-thumbs="1"
					tooltip
					@update:model-value="$emit('update:rating', $event as [number, number])"
				/>
			</UFormField>
			<UFormField :label="personalBestLabel">
				<USelect
					:model-value="personalBest"
					:items="viewerFilterOptions"
					:disabled="viewerFiltersDisabled"
					class="w-full"
					@update:model-value="$emit('update:personalBest', String($event) as ViewerLevelFilter)"
				/>
			</UFormField>
			<UFormField :label="worldRecordLabel">
				<USelect
					:model-value="worldRecord"
					:items="viewerFilterOptions"
					:disabled="viewerFiltersDisabled"
					class="w-full"
					@update:model-value="$emit('update:worldRecord', String($event) as ViewerLevelFilter)"
				/>
			</UFormField>
			<p v-if="viewerFiltersDisabled" class="-mt-2 text-xs text-muted-foreground">
				{{ viewerFiltersDisabledLabel }}
			</p>
			<UFormField :label="sortLabel">
				<USelect :model-value="sort" :items="sortOptions" class="w-full" @update:model-value="$emit('update:sort', String($event) as LevelSort)" />
			</UFormField>
			<UButton color="primary" block @click="$emit('apply')">{{ applyLabel }}</UButton>
		</div>
	</UCard>
</template>

<script setup vapor lang="ts">
import type { LevelSort } from '~/composables/useLevels'
import type { SortOption } from '~/types/app'
import type { LevelTypeFilter, ViewerLevelFilter } from '~/utils/levelExplorer'

defineProps<{
	title: string
	resultCountLabel: string
	search: string
	author: string
	authorSuggestions: SortOption[]
	authorSuggestionsPending: boolean
	adventure: LevelTypeFilter
	points: [number, number]
	rating: [number, number]
	personalBest: ViewerLevelFilter
	worldRecord: ViewerLevelFilter
	sort: LevelSort
	searchLabel: string
	authorLabel: string
	adventureLabel: string
	pointsLabel: string
	ratingLabel: string
	personalBestLabel: string
	worldRecordLabel: string
	viewerFiltersDisabled: boolean
	viewerFiltersDisabledLabel: string
	sortLabel: string
	applyLabel: string
	pointsMinimum: number
	pointsMaximum: number
	ratingMinimum: number
	ratingMaximum: number
	adventureOptions: SortOption<LevelTypeFilter>[]
	viewerFilterOptions: SortOption<ViewerLevelFilter>[]
	sortOptions: SortOption<LevelSort>[]
}>()

defineEmits<{
	'update:search': [value: string]
	'update:author': [value: string]
	'update:adventure': [value: LevelTypeFilter]
	'update:points': [value: [number, number]]
	'update:rating': [value: [number, number]]
	'update:personalBest': [value: ViewerLevelFilter]
	'update:worldRecord': [value: ViewerLevelFilter]
	'update:sort': [value: LevelSort]
	apply: []
}>()

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const formatRange = (range: [number, number]) =>
	`${numberFormat.value.format(range[0])}–${numberFormat.value.format(range[1])}`
const formatRatingRange = (range: [number, number]) =>
	`${numberFormat.value.format(range[0])}%–${numberFormat.value.format(range[1])}%`

</script>
