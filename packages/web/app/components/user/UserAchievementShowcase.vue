<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="labels.title" :description="labels.description" />

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
			<div
				v-for="achievement in achievements"
				:key="achievement.key"
				class="flex min-h-24 flex-col items-center justify-center rounded-xl border border-border bg-gradient-to-br from-card/90 to-primary/5 p-3 text-center"
			>
				<span class="mb-2 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
					<TablerIcon :name="achievement.icon" class="size-5" />
				</span>
				<p class="text-xs font-semibold leading-tight text-highlighted">
					{{ achievement.label }}
				</p>
				<p class="mt-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
					{{ labels.comingSoon }}
				</p>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { UserAchievementPreviewItem } from '~/types/app'

defineProps<{
	id: string
	achievements: UserAchievementPreviewItem[]
	labels: {
		title: string
		description: string
		comingSoon: string
	}
}>()
</script>
