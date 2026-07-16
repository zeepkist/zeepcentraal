<template>
	<UButton
		color="primary"
		size="sm"
		:variant="modelValue ? 'soft' : 'outline'"
		:icon="modelValue ? 'i-tabler-eye-off' : 'i-tabler-eye'"
		:aria-pressed="modelValue"
		@click="$emit('update:modelValue', !modelValue)"
	>
		{{ modelValue ? hideLabel : showLabel }}
	</UButton>
</template>

<script setup lang="ts">
defineProps<{
	modelValue: boolean
	showLabel: string
	hideLabel: string
}>()

defineEmits<{
	'update:modelValue': [value: boolean]
}>()
</script>
