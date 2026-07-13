<template>
	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		<NuxtLink v-for="round in rounds" :key="round.id" :to="link(round)" class="group rounded-xl border border-border bg-card/80 p-5 transition hover:-translate-y-1 hover:border-primary/50"><div class="flex items-center justify-between"><UBadge color="primary" variant="soft">{{ roundLabel.replace('{round}', String(round.round)) }}</UBadge><TablerIcon name="chevron-right" class="transition-transform group-hover:translate-x-1" /></div><h3 class="mt-4 text-lg font-bold">{{ round.name }}</h3><p class="mt-2 text-sm text-muted-foreground"><NuxtTime :datetime="String(round.eventDate)" date-style="medium" /></p></NuxtLink>
	</div>
</template>
<script setup lang="ts">
defineProps<{
	rounds: Array<{ id: number; round: number; name: string; eventDate: unknown }>
	link: (round: { id: number; round: number }) => string
	roundLabel: string
}>()
</script>
