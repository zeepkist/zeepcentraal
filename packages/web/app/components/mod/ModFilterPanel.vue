<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<div class="mb-4 flex items-start justify-between gap-3">
			<div class="flex items-center gap-2">
				<TablerIcon name="adjustments" class="text-primary" />
				<h2 class="font-semibold">{{ title }}</h2>
			</div>
			<UBadge color="neutral" variant="soft" class="shrink-0">{{ resultCountLabel }}</UBadge>
		</div>
		<form class="grid gap-4" @submit.prevent="$emit('apply')">
			<UFormField :label="searchLabel">
				<UInput
					:model-value="search"
					class="w-full"
					:placeholder="searchPlaceholder"
					@update:model-value="$emit('update:search', String($event))"
				>
					<template #leading>
						<TablerIcon name="search" class="size-4 text-muted-foreground" />
					</template>
				</UInput>
			</UFormField>
			<UFormField :label="sortLabel">
				<USelect
					:model-value="sort"
					:items="sortOptions"
					class="w-full"
					@update:model-value="$emit('update:sort', String($event))"
				/>
			</UFormField>
			<UButton type="submit" color="primary" block>{{ applyLabel }}</UButton>
		</form>
	</UCard>
</template>

<script setup lang="ts">
import type { SortOption } from '~/types/app'

defineProps<{
	title: string
	resultCountLabel: string
	search: string
	sort: string
	searchLabel: string
	searchPlaceholder: string
	sortLabel: string
	applyLabel: string
	sortOptions: SortOption[]
}>()

defineEmits<{
	'update:search': [value: string]
	'update:sort': [value: string]
	apply: []
}>()
</script>
