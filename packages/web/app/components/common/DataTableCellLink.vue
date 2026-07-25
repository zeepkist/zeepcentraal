<template>
	<NuxtLink
		v-if="to"
		v-bind="$attrs"
		:to="to"
		:tabindex="focusable ? undefined : -1"
		:aria-label="ariaLabel"
		class="block size-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
	>
		<slot />
	</NuxtLink>
	<span v-else v-bind="$attrs" class="block size-full">
		<slot />
	</span>
</template>

<script setup vapor lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
	to?: string
	focusable?: boolean
	ariaLabel?: string
}>()
</script>
