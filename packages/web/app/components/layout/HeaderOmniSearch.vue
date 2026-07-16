<template>
	<UInputMenu
		:id="id"
		:model-value="query"
		:items="items"
		:loading="pending"
		:placeholder="labels.placeholder"
		:aria-label="labels.label"
		:open-on-focus="true"
		:reset-search-term-on-select="false"
		mode="autocomplete"
		ignore-filter
		clear
		class="w-full"
		data-testid="omni-search"
		:ui="menuUi"
		@update:model-value="$emit('update:query', String($event ?? ''))"
	>
		<template #leading>
			<TablerIcon name="search" class="size-4 text-muted-foreground" />
		</template>

		<template #empty>
			<div class="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
				<TablerIcon
					:name="error ? 'exclamation-circle' : pending ? 'loader-2' : 'search'"
					:class="{ 'animate-spin motion-reduce:animate-none': pending && !error }"
				/>
				<span>{{ emptyLabel }}</span>
			</div>
		</template>

		<template #item="{ item }">
			<div v-if="item.kind === 'user'" class="flex w-full items-center gap-2 px-2.5 py-1.5">
				<span class="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
					<TablerIcon name="user" class="size-4" />
				</span>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold leading-tight text-highlighted">{{ item.name }}</p>
					<p v-if="item.rank != null && item.rank > 0" class="text-xs text-muted-foreground">
						{{ labels.rank }} #{{ numberFormat.format(item.rank) }}
					</p>
				</div>
				<TablerIcon name="chevron-right" class="size-3.5 text-muted-foreground" />
			</div>

			<div v-else-if="item.kind === 'level'" class="flex w-full items-center gap-2 px-2.5 py-1.5">
				<div class="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
					<NuxtImg
						v-if="item.imageUrl"
						:src="item.imageUrl"
						:alt="item.name"
						width="40"
						height="40"
						class="size-full object-cover"
					/>
					<span v-else class="grid size-full place-items-center text-muted-foreground">
						<TablerIcon name="map" class="size-4" />
					</span>
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold leading-tight text-highlighted">{{ item.name }}</p>
					<p class="truncate text-xs text-muted-foreground">
						{{ item.authorName ?? labels.unknownAuthor }}
					</p>
				</div>
				<div class="shrink-0 text-right text-xs tabular-nums">
					<p class="font-semibold text-highlighted">
						{{ item.points == null ? labels.unavailable : numberFormat.format(item.points) }}
						<span class="text-muted-foreground">{{ labels.points }}</span>
					</p>
					<p class="text-muted-foreground">
						{{ item.rating == null ? labels.unavailable : ratingFormat.format(item.rating) }}
						{{ labels.rating }}
					</p>
				</div>
				<TablerIcon name="chevron-right" class="size-3.5 text-muted-foreground" />
			</div>
		</template>
	</UInputMenu>
</template>

<script setup lang="ts">
import type { InputMenuItem } from '@nuxt/ui'
import type { OmniSearchLevelResult, OmniSearchResult, OmniSearchUserResult } from '~/types/app'
import { OMNI_SEARCH_MINIMUM_LENGTH } from '~/utils/omniSearch'

const props = defineProps<{
	id: string
	query: string
	users: OmniSearchUserResult[]
	levels: OmniSearchLevelResult[]
	pending: boolean
	error: boolean
	locale: string
	labels: {
		label: string
		placeholder: string
		users: string
		levels: string
		rank: string
		points: string
		rating: string
		unknownAuthor: string
		unavailable: string
		typeMore: string
		empty: string
		loading: string
		error: string
	}
}>()

const emit = defineEmits<{
	'update:query': [value: string]
	select: [item: OmniSearchResult]
}>()

type SearchMenuItem = InputMenuItem & Partial<OmniSearchResult>

const numberFormat = computed(() => new Intl.NumberFormat(props.locale))
const ratingFormat = computed(
	() => new Intl.NumberFormat(props.locale, { style: 'percent', maximumFractionDigits: 0 }),
)
const emptyLabel = computed(() => {
	if (props.error) return props.labels.error
	if (props.pending) return props.labels.loading
	return props.query.trim().length < OMNI_SEARCH_MINIMUM_LENGTH
		? props.labels.typeMore
		: props.labels.empty
})
const hasBothGroups = computed(() => props.users.length > 0 && props.levels.length > 0)
const menuUi = computed(() => ({
	content: 'w-[min(42rem,calc(100vw-2rem))] lg:w-[min(64rem,calc(100vw-3rem))]',
	viewport: [
		'max-h-[min(34rem,70vh)] lg:max-h-[min(50rem,85vh)]',
		hasBothGroups.value ? 'lg:grid lg:grid-cols-2 lg:items-start' : '',
	],
	group: [
		'min-w-0 p-1',
		hasBothGroups.value
			? 'lg:p-2 lg:[&+&]:border-l lg:[&+&]:border-border/60'
			: 'lg:p-2',
	],
	label: 'px-2.5 py-1.5 text-xs',
	item: 'p-0',
}))
const items = computed<SearchMenuItem[][]>(() => {
	if (props.query.trim().length < OMNI_SEARCH_MINIMUM_LENGTH) return []
	const onSelect = (item: OmniSearchResult) => (event: Event) => {
		event.preventDefault()
		emit('select', item)
	}
	const groups: SearchMenuItem[][] = []
	if (props.users.length > 0) {
		groups.push([
			{ type: 'label', label: props.labels.users },
			...props.users.map((user) => ({ ...user, label: user.name, onSelect: onSelect(user) })),
		])
	}
	if (props.levels.length > 0) {
		groups.push([
			{ type: 'label', label: props.labels.levels },
			...props.levels.map((level) => ({ ...level, label: level.name, onSelect: onSelect(level) })),
		])
	}
	return groups
})
</script>
