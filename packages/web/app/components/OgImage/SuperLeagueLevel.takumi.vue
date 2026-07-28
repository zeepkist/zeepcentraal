<template>
	<OgFrame
		dense
		:eyebrow="`Super League · ${data.seasonName}`"
		:title="data.levelName"
		:description="`Round ${data.roundNumber}: ${data.roundName}`"
		:image-url="data.imageUrl ?? undefined"
		style="font-family: DINish"
	>
		<OgStandings :metrics="metrics" :players="data.players" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
import { computed } from 'vue'
import { formatTournamentTime } from '~/utils/tournament'

const props = defineProps<{ slug: string }>()

const { data, prefetch } = useOgSuperLeagueLevelData(props.slug)
await prefetch()

const metrics = computed(() => [
	{ label: 'Competitors', value: formatOgEventNumber(data.value.competitorCount) },
	{
		label: 'Fastest time',
		value:
			data.value.fastestTime == null
				? 'Unavailable'
				: formatTournamentTime(data.value.fastestTime),
	},
])
</script>
