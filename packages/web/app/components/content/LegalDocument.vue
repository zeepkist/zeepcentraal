<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="eyebrow" :title="title" :description="description" />
		<ContentDocument :document="document" />
	</UContainer>
</template>

<script setup vapor lang="ts">
defineProps<{
	eyebrow: string
	title: string
	description: string
	document: object
}>()
</script>
