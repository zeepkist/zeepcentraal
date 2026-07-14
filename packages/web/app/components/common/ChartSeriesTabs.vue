<template>
	<div class="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1" role="tablist" :aria-label="label">
		<UButton
			v-for="option in options"
			:key="option.value"
			role="tab"
			size="xs"
			:aria-selected="modelValue === option.value"
			:color="modelValue === option.value ? 'primary' : 'neutral'"
			:variant="modelValue === option.value ? 'solid' : 'ghost'"
			@click="$emit('update:modelValue', option.value)"
		>
			<TablerIcon :name="option.icon" class="size-3.5" />
			{{ option.label }}
		</UButton>
	</div>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
	modelValue: T
	label: string
	options: Array<{ value: T; label: string; icon: string }>
}>()

defineEmits<{ 'update:modelValue': [value: T] }>()
</script>
