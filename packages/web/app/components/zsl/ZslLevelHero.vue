<template>
	<section
		class="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-sm shadow-primary/5 sm:p-7 lg:p-9"
	>
		<div class="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,1.1fr)] lg:items-center">
			<div class="min-w-0">
				<p class="text-sm font-bold uppercase tracking-[0.18em] text-primary">{{ labels.eyebrow }}</p>
				<h1
					class="mt-3 text-balance text-4xl font-black tracking-tight text-highlighted md:text-6xl"
					:style="transition.targetStyle('zsl-level', transitionId, 'title')"
					data-shared-transition-target="title"
				>
					{{ title }}
				</h1>
				<p class="mt-3 text-lg text-muted-foreground">{{ context }}</p>

				<div class="mt-7 flex flex-wrap gap-3">
					<UButton
						v-if="levelUrl"
						:to="levelUrl"
						color="primary"
						size="lg"
						icon="i-tabler-chart-bar"
					>
						{{ labels.openLevel }}
					</UButton>
					<UButton
						v-if="workshopUrl"
						:to="workshopUrl"
						target="_blank"
						rel="noopener"
						color="neutral"
						variant="soft"
						size="lg"
						icon="i-tabler-brand-steam"
						trailing-icon="i-tabler-external-link"
					>
						{{ labels.workshop }}
					</UButton>
				</div>

				<ZslPageFacts
					class="mt-7"
					:competitor-count="competitorCount"
					:event-date="eventDate"
					:labels="labels"
				/>
			</div>

			<div
				class="overflow-hidden rounded-2xl border border-border/70 bg-default/70 shadow-lg"
				:style="transition.targetStyle('zsl-level', transitionId, 'media')"
				data-shared-transition-target="media"
			>
				<NuxtImg
					v-if="imageSrc"
					:src="imageSrc"
					:alt="title"
					format="avif"
					width="1600"
					height="900"
					sizes="100vw lg:40vw"
					class="aspect-video w-full object-cover"
					loading="eager"
					preload
					fetchpriority="high"
				/>
				<div v-else class="flex aspect-video items-center justify-center bg-muted">
					<TablerIcon name="photo-off" class="size-12 text-muted-foreground" />
				</div>
			</div>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
defineProps<{
	title: string
	context: string
	imageSrc?: string | null
	levelUrl?: string
	workshopUrl?: string
	competitorCount: number
	eventDate: unknown
	transitionId: string | number
	labels: {
		eyebrow: string
		openLevel: string
		workshop: string
		competitors: string
		playedOn: string
	}
}>()

const transition = useSharedViewTransition()
</script>
