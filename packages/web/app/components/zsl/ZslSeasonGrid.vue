<template>
	<div class="grid gap-4 md:grid-cols-2">
		<ZslCard
			v-for="season in seasons"
			:key="season.id"
			:to="superLeagueSeasonPath(season.id)"
			icon="trophy"
			:shared-transition="{
				entity: 'zsl-season',
				entityId: season.id,
				scope: transitionScope,
				preview: { title: season.name },
			}"
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
				<div class="flex flex-wrap gap-2">
					<UBadge color="neutral" variant="soft">
						{{ roundsLabel(season.zslRounds.nodes.length) }}
					</UBadge>
					<UBadge color="primary" variant="soft">
						{{ competitorsLabel(season.zslSeasonResults.totalCount) }}
					</UBadge>
				</div>
			</template>
		</ZslCard>
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	seasons: Array<{
		id: number
		name: string
		startDate: unknown
		endDate: unknown
		zslSeasonResults: { totalCount: number }
		zslRounds: { nodes: unknown[] }
	}>
	roundsLabel: (count: number) => string
	competitorsLabel: (count: number) => string
	transitionScope: string
}>()
</script>
