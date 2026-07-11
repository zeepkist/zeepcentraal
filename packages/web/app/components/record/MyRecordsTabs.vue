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

<script setup lang="ts">
import type { MyRecordView } from '~/utils/myRecords'

defineProps<{
	label: string
	modelValue: MyRecordView
	options: Array<{ value: MyRecordView; label: string; icon: string }>
}>()

defineEmits<{
	'update:modelValue': [value: MyRecordView]
}>()
</script>
