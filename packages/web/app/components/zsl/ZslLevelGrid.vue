<template>
	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		<ZslCard
			v-for="entry in levels"
			:key="entry.id"
			:to="link(entry.id)"
			icon="flag-checkered"
			:image-src="entry.level?.levelItems.nodes[0]?.imageUrl"
			:image-alt="entry.level?.levelItems.nodes[0]?.name ?? levelLabel"
		>
			<template #title>
				<h3 class="truncate text-lg font-bold text-highlighted">
					{{ entry.level?.levelItems.nodes[0]?.name ?? levelLabel }}
				</h3>
			</template>
			<template #footer>
				<span class="font-semibold text-primary">{{ resultsLabel }}</span>
			</template>
		</ZslCard>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	levels: Array<{
		id: number
		level?: {
			levelItems: { nodes: Array<{ name: string; imageUrl?: string | null }> }
		} | null
	}>
	link: (id: number) => string
	levelLabel: string
	resultsLabel: string
}>()
</script>
