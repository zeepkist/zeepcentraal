<template>
	<OgFrame
		dense
		eyebrow="Super League"
		:title="data.seasonName"
		description="Season standings"
		style="font-family: DINish"
	>
		<OgStandings
			:metrics="[
				{ label: 'Competitors', value: formatOgEventNumber(data.competitorCount) },
			]"
			:players="data.players"
		/>
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{ slug: string }>()

const { data, prefetch } = useOgSuperLeagueSeasonData(props.slug)
await prefetch()
</script>
