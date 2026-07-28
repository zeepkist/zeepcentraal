<template>
	<OgFrame
		dense
		eyebrow="Competition archive"
		title="Super League"
		description="Seasons, rounds and standings from Zeepkist Super League."
		style="font-family: DINish"
	>
		<div v-if="data.seasons.length" class="flex gap-3">
			<div
				v-for="season in data.seasons"
				:key="season.id"
				class="flex min-w-0 flex-1 flex-col rounded-2xl border border-[#44403c] bg-[#171513] p-4"
			>
				<div class="truncate text-[25px] font-black text-[#fafaf9]">{{ season.name }}</div>
				<div class="mt-1 text-[16px] text-[#a8a29e]">{{ season.dates }}</div>
				<div
					class="mt-3 text-[19px] font-bold text-[#facc15]"
					style="font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1"
				>
					{{ formatOgEventNumber(season.roundCount) }} rounds ·
					{{ formatOgEventNumber(season.competitorCount) }} competitors
				</div>
			</div>
		</div>
	</OgFrame>
</template>

<script setup vapor lang="ts">
defineProps<{ slug: string }>()

const { data, prefetch } = useOgSuperLeagueData()
await prefetch()
</script>
