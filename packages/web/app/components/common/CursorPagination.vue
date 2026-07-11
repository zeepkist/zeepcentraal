<template>
	<nav class="flex items-center justify-between gap-3" :aria-label="label">
		<UButton color="neutral" variant="soft" :disabled="!page.hasPreviousPage || pending" @click="$emit('previous')">
			<TablerIcon name="chevron-left" class="size-4" />
			{{ previousLabel }}
		</UButton>
		<UButton color="neutral" variant="soft" :disabled="!page.hasNextPage || pending" @click="$emit('next')">
			{{ nextLabel }}
			<TablerIcon name="chevron-right" class="size-4" />
		</UButton>
	</nav>
</template>

<script setup lang="ts">
import type { CursorPage } from '~/types/app'

defineProps<{
	page: CursorPage
	pending?: boolean
	label: string
	previousLabel: string
	nextLabel: string
}>()

defineEmits<{ previous: []; next: [] }>()
</script>
