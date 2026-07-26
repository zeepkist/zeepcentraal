<template>
	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		<ZslCard
			v-for="round in rounds"
			:key="round.id"
			:to="link(round)"
			icon="calendar-event"
		>
			<template #eyebrow>
				<UBadge color="primary" variant="soft">
					{{ $t('zsl.roundNumber', { round: round.round }) }}
				</UBadge>
			</template>
			<template #title>
				<h3 class="mt-3 truncate text-lg font-bold text-highlighted">{{ round.name }}</h3>
			</template>
			<template #footer>
				<span class="flex items-center gap-2 text-muted-foreground">
					<TablerIcon name="clock" class="size-4 text-primary" />
					<NuxtTime :datetime="String(round.eventDate)" date-style="medium" />
				</span>
			</template>
		</ZslCard>
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	rounds: Array<{ id: number; round: number; name: string; eventDate: unknown }>
	link: (round: { id: number; round: number }) => string
}>()
</script>
