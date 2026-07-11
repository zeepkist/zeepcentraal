<template>
	<UCard class="group h-full overflow-hidden rounded-xl border-border bg-card/85 transition motion-safe:hover:-translate-y-1">
		<NuxtLink :to="`/level/${level.xxHash}`" class="block">
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
				<UBadge v-if="level.adventure" color="primary" variant="soft">{{ adventureLabel }}</UBadge>
			</div>
			<div class="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
				<span v-if="level.points != null">{{ pointsLabel }}: {{ level.points }}</span>
				<span v-if="level.recordCount != null">{{ recordsLabel }}: {{ level.recordCount }}</span>
			</div>
		</NuxtLink>
	</UCard>
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
