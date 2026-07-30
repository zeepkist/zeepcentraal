<script setup vapor lang="ts">
import type {
	SharedViewTransitionEntity,
	SharedViewTransitionPreview,
} from '~/utils/sharedViewTransition'

const props = withDefaults(
	defineProps<{
		entity: SharedViewTransitionEntity
		entityId: string | number
		preview: SharedViewTransitionPreview
		compact?: boolean
	}>(),
	{ compact: false },
)

const transition = useSharedViewTransition()
const titleStyle = computed(() => transition.targetStyle(props.entity, props.entityId, 'title'))
const mediaStyle = computed(() => transition.targetStyle(props.entity, props.entityId, 'media'))
const metricStyle = computed(() => transition.targetStyle(props.entity, props.entityId, 'metric'))
</script>

<template>
	<section
		class="overflow-hidden border border-primary/20 bg-linear-to-br from-card via-card to-primary/10"
		:class="compact ? 'rounded-xl p-5' : 'rounded-3xl p-5 sm:p-7 lg:p-9'"
		aria-busy="true"
	>
		<div
			class="grid gap-7"
			:class="preview.mediaUrl === undefined ? '' : 'lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center'"
		>
			<div class="min-w-0">
				<h1
					class="text-balance font-black tracking-tight text-highlighted"
					:class="compact ? 'text-3xl md:text-4xl' : 'text-4xl md:text-6xl'"
					:style="titleStyle"
					data-shared-transition-target="title"
				>
					{{ preview.title }}
				</h1>
				<p v-if="preview.subtitle" class="mt-3 text-lg text-muted-foreground">
					{{ preview.subtitle }}
				</p>
				<p
					v-if="preview.metric"
					class="mt-5 w-fit rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-3xl font-black tabular-nums text-highlighted"
					:style="metricStyle"
					data-shared-transition-target="metric"
				>
					{{ preview.metric }}
				</p>
				<div class="mt-7 grid gap-3 sm:grid-cols-3">
					<USkeleton v-for="index in 3" :key="index" class="h-16 rounded-xl" />
				</div>
			</div>
			<div
				v-if="preview.mediaUrl !== undefined"
				class="aspect-video overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-lg"
				:style="mediaStyle"
				data-shared-transition-target="media"
			>
				<NuxtImg
					v-if="preview.mediaUrl"
					:src="preview.mediaUrl"
					:alt="preview.mediaAlt ?? preview.title"
					format="avif"
					width="1600"
					height="900"
					sizes="100vw lg:40vw"
					class="size-full object-cover"
					loading="eager"
				/>
				<div v-else class="grid size-full place-items-center">
					<TablerIcon name="photo-off" class="size-12 text-muted-foreground" />
				</div>
			</div>
		</div>
	</section>
</template>
