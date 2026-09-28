<script setup vapor lang="ts">
defineProps<{ label: string }>()
</script>

<template>
	<div class="grid min-h-[calc(100dvh-16rem)] place-items-center" role="status" aria-live="polite" aria-busy="true">
		<div class="flex flex-col items-center gap-4 text-muted-foreground">
			<TablerIcon name="loader-2" class="size-9 text-primary motion-safe:animate-spin" aria-hidden="true" />
			<p>{{ label }}</p>
		</div>
	</div>
</template>
