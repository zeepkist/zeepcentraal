<template>
	<UCard :ui="{ root: 'rounded-lg border-border bg-card/80' }">
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-sm text-muted-foreground">
					{{ label }}
				</p>
				<p class="tabular mt-2 text-3xl font-bold">
					{{ value }}
				</p>
			</div>
			<div class="rounded-md bg-primary/10 p-2 text-primary">
				<TablerIcon :name="icon" />
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	label: string
	value: string
	icon: string
}>()
</script>
