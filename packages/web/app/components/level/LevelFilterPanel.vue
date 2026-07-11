<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<div class="mb-4 flex items-center gap-2">
			<TablerIcon name="adjustments" class="text-primary" />
			<h2 class="font-semibold">{{ title }}</h2>
		</div>
		<div class="grid gap-4">
			<UFormField :label="searchLabel">
				<UInput :model-value="search" class="w-full" @update:model-value="$emit('update:search', String($event))">
					<template #leading><TablerIcon name="search" class="size-4 text-muted-foreground" /></template>
				</UInput>
			</UFormField>
			<UFormField :label="authorLabel">
				<UInput :model-value="author" class="w-full" @update:model-value="$emit('update:author', String($event))" />
			</UFormField>
			<UFormField :label="adventureLabel">
				<USelect :model-value="adventure" :items="adventureOptions" class="w-full" @update:model-value="$emit('update:adventure', String($event))" />
			</UFormField>
			<UFormField :label="sortLabel">
				<USelect :model-value="sort" :items="sortOptions" class="w-full" @update:model-value="$emit('update:sort', String($event))" />
			</UFormField>
			<UButton color="primary" block @click="$emit('apply')">{{ applyLabel }}</UButton>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import type { SortOption } from '~/types/app'

defineProps<{
	title: string
	search: string
	author: string
	adventure: string
	sort: string
	searchLabel: string
	authorLabel: string
	adventureLabel: string
	sortLabel: string
	applyLabel: string
	adventureOptions: SortOption[]
	sortOptions: SortOption[]
}>()

defineEmits<{
	'update:search': [value: string]
	'update:author': [value: string]
	'update:adventure': [value: string]
	'update:sort': [value: string]
	apply: []
}>()
</script>
