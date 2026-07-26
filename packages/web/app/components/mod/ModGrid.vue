<template>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
		<ModCard v-for="mod in mods" :key="mod.id" :mod="mod" v-bind="labels" />
	</div>
</template>

<script setup vapor lang="ts">
import type { ModSummary } from '~/types/mod'

defineProps<{
	mods: readonly ModSummary[]
	labels: {
		versionLabel: string
		sizeLabel: string
		downloadsLabel: string
		ratingLabel: string
		updatedLabel: string
		openModioLabel: string
		unavailableLabel: string
	}
}>()
</script>
