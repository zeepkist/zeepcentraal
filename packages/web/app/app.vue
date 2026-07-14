<template>
	<UApp>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup lang="ts">
import { resolveInitialColourMode } from '~/utils/colourMode'

const colourMode = useColorMode()
const resolvedColourMode = computed(() => {
	if (colourMode.preference === 'system' && import.meta.client) {
		return resolveInitialColourMode(colourMode.value)
	}

	return resolveInitialColourMode(colourMode.preference)
})

useHead({
	htmlAttrs: {
		class: resolvedColourMode,
	},
})

await useCurrentUser()
</script>
