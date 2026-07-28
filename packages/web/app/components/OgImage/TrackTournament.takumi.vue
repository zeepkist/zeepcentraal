<template>
	<OgFrame
		dense
		:eyebrow="data.eyebrow"
		:title="data.title"
		:description="data.description"
		:image-url="data.imageUrl ?? undefined"
		style="font-family: DINish"
	>
		<OgStandings
			v-if="data.metrics.length > 0"
			:metrics="data.metrics"
			:players="data.players"
		/>
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{
	slug: string
	type: 0 | 1
}>()

const { data, prefetch } = useOgTrackTournamentData(props.type, props.slug)
await prefetch()
</script>
