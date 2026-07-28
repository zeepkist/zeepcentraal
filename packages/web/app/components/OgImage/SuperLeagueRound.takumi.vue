<template>
	<OgFrame
		dense
		:eyebrow="`Super League · ${data.seasonName}`"
		:title="`Round ${data.roundNumber}: ${data.roundName}`"
		description="Round standings"
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

const { data, prefetch } = useOgSuperLeagueRoundData(props.slug)
await prefetch()
</script>
