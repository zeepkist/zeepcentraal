<template>
	<div class="flex min-w-0 items-center gap-2">
		<span class="shrink-0 text-sm font-medium text-muted-foreground">{{ label }}</span>
		<USelect
			:model-value="modelValue"
			:items="items"
			icon="i-tabler-calendar-stats"
			class="w-40"
			:aria-label="label"
			@update:model-value="$emit('update:modelValue', String($event) as UserTelemetryPeriod)"
		/>
	</div>
</template>

<script setup lang="ts">
import type { SortOption } from '~/types/app'
import type { UserTelemetryPeriod } from '~/utils/userTelemetry'

defineProps<{
	modelValue: UserTelemetryPeriod
	label: string
	items: SortOption[]
}>()

defineEmits<{ 'update:modelValue': [value: UserTelemetryPeriod] }>()
</script>
