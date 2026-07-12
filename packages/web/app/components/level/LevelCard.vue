<template>
	<NuxtLink
		:to="`/level/${level.xxHash}`"
		class="group block h-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 p-4 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
	>
		<div class="aspect-video overflow-hidden rounded-lg bg-muted">
			<NuxtImg
				v-if="level.imageUrl"
				:src="level.imageUrl"
				:alt="level.name"
				class="size-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
				loading="lazy"
			/>
		</div>
		<div class="mt-4 flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h3 class="truncate text-lg font-semibold text-highlighted">{{ level.name }}</h3>
				<p class="truncate text-sm text-muted-foreground">{{ level.authorName }}</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<UBadge v-if="level.adventure" color="primary" variant="soft">{{ adventureLabel }}</UBadge>
				<TablerIcon
					name="chevron-right"
					class="size-5 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-1"
				/>
			</div>
		</div>
		<div class="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
			<span v-if="level.points != null">{{ pointsLabel }}: {{ level.points }}</span>
			<span v-if="level.recordCount != null">{{ recordsLabel }}: {{ level.recordCount }}</span>
		</div>
	</NuxtLink>
</template>

<script setup lang="ts">
import type { LevelSummary } from '~/types/app'

defineProps<{
	level: LevelSummary
	adventureLabel: string
	pointsLabel: string
	recordsLabel: string
}>()
</script>
