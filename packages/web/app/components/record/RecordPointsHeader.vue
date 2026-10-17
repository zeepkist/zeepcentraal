<template>
	<UTooltip v-if="help" :text="help">
		<button
			type="button"
			class="inline-flex cursor-help items-center gap-1 rounded-sm text-left font-medium underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
			:aria-label="label"
		>
			<span>{{ label }}</span>
			<TablerIcon name="info-circle" class="size-3.5 shrink-0" aria-hidden="true" />
		</button>
	</UTooltip>
	<span v-else>{{ label }}</span>
</template>

<script setup lang="ts">
defineProps<{
	label: string
	help?: string
}>()
</script>
