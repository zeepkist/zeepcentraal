<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="labels.title" :description="labels.description" />

		<div class="space-y-5 rounded-xl border border-border bg-card/70 p-4">
			<div>
				<div class="mb-2 flex items-center justify-between gap-3 text-sm">
					<span class="font-semibold text-highlighted">{{ labels.progress }}</span>
					<span class="tabular-nums text-muted-foreground">{{ progressValue }}</span>
				</div>
				<UProgress :model-value="progress.percentage ?? 0" :max="100" color="neutral" class="opacity-60" />
				<p class="mt-2 text-xs text-muted-foreground">{{ labels.comingSoon }}</p>
			</div>

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
				<div>
					<h3 class="mb-2 flex items-center gap-2 text-sm font-semibold text-highlighted">
						<TablerIcon name="sparkles" class="size-4 text-primary" />
						{{ labels.rarest }}
					</h3>
					<ul class="space-y-1.5">
						<li
							v-for="category in progress.categories"
							:key="`rarest-${category.key}`"
							class="flex items-center gap-2 rounded-lg bg-muted/45 px-2.5 py-2"
						>
							<TablerIcon :name="category.icon" class="size-4 shrink-0 text-primary" />
							<span class="min-w-0 flex-1 truncate text-xs font-medium">{{ category.label }}</span>
							<span class="truncate text-[0.625rem] text-muted-foreground">
								{{ category.rarest ?? labels.unavailable }}
							</span>
						</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 flex items-center gap-2 text-sm font-semibold text-highlighted">
						<TablerIcon name="clock-24" class="size-4 text-primary" />
						{{ labels.mostUsed }}
					</h3>
					<ul class="space-y-1.5">
						<li
							v-for="category in progress.categories"
							:key="`used-${category.key}`"
							class="flex items-center gap-2 rounded-lg bg-muted/45 px-2.5 py-2"
						>
							<TablerIcon :name="category.icon" class="size-4 shrink-0 text-primary" />
							<span class="min-w-0 flex-1 truncate text-xs font-medium">{{ category.label }}</span>
							<span class="truncate text-[0.625rem] text-muted-foreground">
								{{ category.mostUsed ?? labels.unavailable }}
							</span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { UserCosmeticProgressPreview } from '~/types/app'

const props = defineProps<{
	id: string
	progress: UserCosmeticProgressPreview
	labels: {
		title: string
		description: string
		progress: string
		rarest: string
		mostUsed: string
		comingSoon: string
		unavailable: string
	}
}>()

const progressValue = computed(() => {
	if (props.progress.unlocked == null || props.progress.total == null) {
		return props.labels.unavailable
	}

	return `${props.progress.unlocked} / ${props.progress.total}`
})
</script>
