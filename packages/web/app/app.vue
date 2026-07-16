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
useServerHead({
	htmlAttrs: {
		class: resolveInitialColourMode(colourMode.preference),
	},
})

await useCurrentUser()
</script>
