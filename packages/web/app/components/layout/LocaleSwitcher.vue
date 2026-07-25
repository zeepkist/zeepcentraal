<template>
	<UDropdownMenu :items="items" :content="{ align: 'end' }">
		<UButton color="neutral" variant="ghost" size="sm" square :aria-label="label">
			<TablerIcon name="world" />
		</UButton>
	</UDropdownMenu>
</template>

<script setup vapor lang="ts">
import type { LocaleOption } from '~/types/app'

const props = defineProps<{
	label: string
	locale: string
	options: LocaleOption[]
}>()
const emit = defineEmits<{ select: [code: string] }>()
const items = computed(() => [
	props.options.map((option) => ({
		label: option.name,
		type: 'checkbox' as const,
		checked: option.code === props.locale,
		onSelect: () => emit('select', option.code),
	})),
])
</script>
