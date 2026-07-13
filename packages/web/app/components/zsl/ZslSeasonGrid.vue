<template>
	<div class="grid gap-4 md:grid-cols-2">
		<ZslCard
			v-for="season in seasons"
			:key="season.id"
			:to="superLeagueSeasonPath(season.id)"
			icon="trophy"
		>
			<template #title>
				<h2 class="text-2xl font-black text-highlighted">{{ season.name }}</h2>
			</template>
			<template #meta>
				<div class="flex items-center gap-2">
					<TablerIcon name="calendar-event" class="size-4 text-primary" />
					<span>
						<NuxtTime :datetime="String(season.startDate)" date-style="medium" />
						–
						<NuxtTime :datetime="String(season.endDate)" date-style="medium" />
					</span>
				</div>
			</template>
			<template #footer>
				<UBadge color="neutral" variant="soft">
					{{ roundsLabel(season.zslRounds.nodes.length) }}
				</UBadge>
			</template>
		</ZslCard>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	seasons: Array<{
		id: number
		name: string
		startDate: unknown
		endDate: unknown
		zslRounds: { nodes: unknown[] }
	}>
	roundsLabel: (count: number) => string
}>()
</script>
