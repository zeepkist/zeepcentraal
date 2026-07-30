<template>
	<UApp>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup vapor lang="ts">
import { resolveInitialColourMode } from '~/utils/colourMode'

const colourMode = useColorMode()

if (import.meta.server) {
	useHead({
		htmlAttrs: {
			class: resolveInitialColourMode(colourMode.preference),
		},
	})
}

await useCurrentUser()
</script>
