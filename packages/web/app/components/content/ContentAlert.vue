<template>
	<UAlert
		:title="title"
		:color="variant.color"
		variant="subtle"
		class="not-prose my-6 border"
		:ui="{ description: 'text-sm leading-6 text-toned' }"
	>
		<template #leading>
			<TablerIcon :name="variant.icon" class="size-5" />
		</template>
		<template #description>
			<div class="space-y-2 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_p]:m-0">
				<slot />
			</div>
		</template>
	</UAlert>
</template>

<script setup vapor lang="ts">
import type { TablerIconName } from '~/utils/icons'

type AlertType = 'notice' | 'important' | 'reminder'

const props = defineProps<{
	title: string
	type: AlertType
}>()

const variants: Record<AlertType, { color: 'info' | 'warning' | 'primary'; icon: TablerIconName }> = {
	notice: { color: 'info', icon: 'info-circle' },
	important: { color: 'warning', icon: 'alert-triangle' },
	reminder: { color: 'primary', icon: 'bell' },
}
const variant = computed(() => variants[props.type])
</script>
