<template>
	<div class="flex flex-wrap gap-2" role="tablist" :aria-label="label">
		<UButton
			v-for="option in options"
			:key="option.value"
			role="tab"
			:aria-selected="modelValue === option.value"
			:color="modelValue === option.value ? 'primary' : 'neutral'"
			:variant="modelValue === option.value ? 'solid' : 'soft'"
			@click="$emit('update:modelValue', option.value)"
		>
			<TablerIcon :name="option.icon" class="size-4" />
			{{ option.label }}
		</UButton>
	</div>
</template>

<script setup vapor lang="ts">
import type { RecordHistoryView } from '~/utils/recordHistory'

defineProps<{
	label: string
	modelValue: RecordHistoryView
	options: Array<{ value: RecordHistoryView; label: string; icon: string }>
}>()

defineEmits<{
	'update:modelValue': [value: RecordHistoryView]
}>()
</script>
