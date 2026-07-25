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
			:disabled="mounted && option.disabled"
			@click="select(option)"
		>
			<TablerIcon :name="option.icon" class="size-3.5" />
			{{ option.label }}
		</UButton>
	</div>
</template>

<script setup vapor lang="ts" generic="T extends string">
const props = defineProps<{
	modelValue: T
	label: string
	options: Array<{ value: T; label: string; icon: string; disabled?: boolean }>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const mounted = ref(false)

onMounted(() => {
	mounted.value = true
})

function select(option: (typeof props.options)[number]) {
	if (!option.disabled) emit('update:modelValue', option.value)
}
</script>
