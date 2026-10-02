<script setup vapor lang="ts">
import type { SortOption } from '~/types/app'
import { WORKSHOP_SORTS, type WorkshopSort } from '~/utils/workshop'

defineProps<{
	search: string
	author: string
	sort: WorkshopSort
	resultCount: number
	authorSuggestions: SortOption[]
	authorSuggestionsPending: boolean
}>()
defineEmits<{
	'update:search': [value: string]
	'update:author': [value: string]
	'update:sort': [value: WorkshopSort]
	apply: []
}>()
const { t } = useI18n()
const sortOptions = computed(() => [
	{ label: t('workshop.sort.latest'), value: WORKSHOP_SORTS.latest },
	{ label: t('workshop.sort.updated'), value: WORKSHOP_SORTS.updated },
	{ label: t('workshop.sort.name'), value: WORKSHOP_SORTS.name },
])
</script>

<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 class="font-semibold">{{ $t('workshop.filters.title') }}</h2>
			<UBadge color="neutral" variant="soft">{{ $t('workshop.results', { count: resultCount }) }}</UBadge>
		</div>
		<form class="grid gap-4" @submit.prevent="$emit('apply')">
			<UFormField :label="$t('workshop.filters.search')">
				<UInput :model-value="search" class="w-full" @update:model-value="$emit('update:search', String($event))" />
			</UFormField>
			<UFormField :label="$t('workshop.filters.author')">
				<UInputMenu :model-value="author" :items="authorSuggestions" :loading="authorSuggestionsPending" :placeholder="$t('workshop.filters.author')" class="w-full" mode="autocomplete" value-key="value" ignore-filter clear @update:model-value="$emit('update:author', String($event ?? ''))" />
			</UFormField>
			<UFormField :label="$t('workshop.filters.sort')">
				<USelect :model-value="sort" :items="sortOptions" class="w-full" @update:model-value="$emit('update:sort', String($event) as WorkshopSort)" />
			</UFormField>
			<UButton type="submit" color="primary" block>{{ $t('workshop.filters.apply') }}</UButton>
		</form>
	</UCard>
</template>
