<template>
	<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 :id="id" class="text-2xl font-bold">{{ title }}</h2>
			<p v-if="description" class="mt-1 text-muted-foreground">{{ description }}</p>
		</div>
		<slot />
	</div>
</template>

<script setup lang="ts">
defineProps<{ id?: string; title: string; description?: string }>()
</script>
