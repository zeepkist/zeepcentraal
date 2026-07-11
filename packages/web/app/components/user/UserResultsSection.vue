<template>
	<section :aria-labelledby="id">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<SectionHeader :id="id" :title="title" :description="description" />
			<USelect :model-value="sort" :items="sortOptions" class="w-44" :aria-label="labels.value" @update:model-value="$emit('update:sort', String($event) as 'valuable' | 'recent')" />
		</div>
		<DataState :pending="pending" :error="error" :empty="records.length === 0" :loading-label="paginationLabels.label" :error-title="paginationLabels.label" :empty-title="paginationLabels.label">
			<UserResultTable :records="records" :labels="labels" />
		</DataState>
		<CursorPagination class="mt-4" :page="page" :pending="pending" v-bind="paginationLabels" @previous="$emit('previous')" @next="$emit('next')" />
	</section>
</template>

<script setup lang="ts">
import type { CursorPage, RecordRow, SortOption } from '~/types/app'

defineProps<{
	id: string
	title: string
	description: string
	records: RecordRow[]
	sort: 'valuable' | 'recent'
	pending: boolean
	error?: string | null
	page: CursorPage
	labels: { rank: string; level: string; time: string; value: string; date: string }
	sortOptions: SortOption[]
	paginationLabels: { label: string; previousLabel: string; nextLabel: string }
}>()
defineEmits<{
	'update:sort': [value: 'valuable' | 'recent']
	previous: []
	next: []
}>()
</script>
