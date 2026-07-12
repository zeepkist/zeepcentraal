<template>
	<div class="flex flex-wrap items-end justify-between gap-4">
		<MyRecordsTabs
			:model-value="view"
			:label="viewLabel"
			:options="viewOptions"
			@update:model-value="$emit('update:view', $event)"
		/>
		<div class="min-w-56">
			<p :id="`${sortId}-label`" class="mb-1.5 block text-sm font-medium text-muted-foreground">
				{{ sortLabel }}
			</p>
			<USelect
				:id="sortId"
				:aria-labelledby="`${sortId}-label`"
				:model-value="sort"
				:items="sortOptions"
				class="w-full"
				@update:model-value="$emit('update:sort', String($event) as RecordHistorySort)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SortOption } from '~/types/app'
import type { RecordHistorySort, RecordHistoryView } from '~/utils/recordHistory'

defineProps<{
	view: RecordHistoryView
	viewLabel: string
	viewOptions: Array<{ value: RecordHistoryView; label: string; icon: string }>
	sort: RecordHistorySort
	sortLabel: string
	sortOptions: SortOption<RecordHistorySort>[]
	sortId: string
}>()

defineEmits<{
	'update:view': [value: RecordHistoryView]
	'update:sort': [value: RecordHistorySort]
}>()
</script>
