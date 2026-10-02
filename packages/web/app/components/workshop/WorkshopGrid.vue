<script setup vapor lang="ts">
import type { WorkshopSummary } from '~/types/app'

withDefaults(defineProps<{ workshops: WorkshopSummary[]; columns?: 3 | 4 }>(), { columns: 3 })
</script>

<template>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2" :class="{ '3xl:grid-cols-4 2xl:grid-cols-3 xl:grid-cols-2': columns === 4, 'xl:grid-cols-3': columns === 3 }">
		<WorkshopCard v-for="workshop in workshops" :key="workshop.workshopId" :workshop="workshop" />
	</div>
</template>
