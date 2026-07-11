<template>
	<div class="space-y-10">
		<section v-for="group in series" :key="group.key" :aria-labelledby="`series-${group.key}`">
			<SectionHeader :id="`series-${group.key}`" :title="seriesLabel.replace('{series}', group.key)" :description="countLabel.replace('{count}', String(group.levels.length))" />
			<LevelGrid :levels="group.levels" v-bind="levelLabels" />
		</section>
	</div>
</template>
<script setup lang="ts">
import type { AdventureSeries } from '~/composables/useAdventure'

defineProps<{
	series: AdventureSeries[]
	seriesLabel: string
	countLabel: string
	levelLabels: { adventureLabel: string; pointsLabel: string; recordsLabel: string }
}>()
</script>
