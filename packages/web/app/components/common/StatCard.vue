<template>
	<UCard :ui="{ root: 'rounded-lg border-border bg-card/80' }">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1">
				<p class="text-sm text-muted-foreground">
					{{ label }}
				</p>
				<p :aria-label="valueLabel" class="tabular mt-2 text-3xl font-bold">
					{{ value }}
				</p>
				<dl v-if="details?.length" class="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
					<div v-for="detail in details" :key="detail.label" class="min-w-0">
						<dt class="truncate text-xs text-muted-foreground">
							{{ detail.label }}
						</dt>
						<dd class="tabular mt-1 font-semibold">
							{{ detail.value }}
						</dd>
					</div>
				</dl>
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
	valueLabel?: string
	icon: string
	details?: Array<{ label: string; value: string }>
}>()
</script>
