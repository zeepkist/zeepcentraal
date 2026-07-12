<template>
	<nav class="flex flex-wrap items-center justify-between gap-3" :aria-label="label">
		<div class="flex items-center gap-2">
			<UButton
				color="neutral"
				variant="soft"
				:disabled="!page.hasPreviousPage || pending"
				@click="$emit('first')"
			>
				<TablerIcon name="chevrons-left" class="size-4" />
				{{ firstLabel }}
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:disabled="!page.hasPreviousPage || pending"
				@click="$emit('previous')"
			>
				<TablerIcon name="chevron-left" class="size-4" />
				{{ previousLabel }}
			</UButton>
		</div>
		<div class="flex items-center gap-2">
			<UButton
				color="neutral"
				variant="soft"
				:disabled="!page.hasNextPage || pending"
				@click="$emit('next')"
			>
				{{ nextLabel }}
				<TablerIcon name="chevron-right" class="size-4" />
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:disabled="!page.hasNextPage || pending"
				@click="$emit('last')"
			>
				{{ lastLabel }}
				<TablerIcon name="chevrons-right" class="size-4" />
			</UButton>
		</div>
	</nav>
</template>

<script setup lang="ts">
import type { CursorPage } from '~/types/app'

defineProps<{
	page: CursorPage
	pending?: boolean
	label: string
	firstLabel: string
	previousLabel: string
	nextLabel: string
	lastLabel: string
}>()

defineEmits<{ first: []; previous: []; next: []; last: [] }>()
</script>
