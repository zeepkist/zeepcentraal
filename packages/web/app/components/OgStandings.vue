<template>
	<div class="flex min-h-0 flex-col gap-3 overflow-hidden">
		<OgMetrics compact :items="metrics" />
		<OgPodium compact :players="players" />
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	metrics: Array<{
		label: string
		value: string
	}>
	players: Array<{
		name: string
		points: string
		rank?: number
	}>
}>()
</script>
