<template>
	<article
		class="group relative h-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1 focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/5"
	>
		<NuxtLink
			:to="`/mod/${mod.slug}`"
			:aria-label="mod.name"
			class="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
		/>
		<div class="h-full p-4">
			<div class="relative aspect-video overflow-hidden rounded-lg bg-muted">
				<NuxtImg
					v-if="mod.imageUrl"
					:src="mod.imageUrl"
					:alt="mod.name"
					class="size-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
					loading="lazy"
				/>
				<div v-else class="grid size-full place-items-center">
					<TablerIcon name="photo-off" class="size-10 text-muted-foreground" />
				</div>
				<UBadge
					v-if="essentialsTag"
					color="primary"
					variant="solid"
					class="absolute left-2 top-2 shadow-sm"
				>
					{{ essentialsTag }}
				</UBadge>
			</div>
			<div class="mt-4 flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="truncate text-lg font-semibold text-highlighted">{{ mod.name }}</h3>
					<p class="truncate text-sm text-muted-foreground">{{ mod.authorName }}</p>
				</div>
				<a
					:href="mod.profileUrl"
					target="_blank"
					rel="noopener noreferrer"
					class="relative z-20 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:hover:-translate-y-0.5"
					:aria-label="`${openModioLabel}: ${mod.name}`"
				>
					<TablerIcon name="download" class="size-5" />
				</a>
			</div>
			<div class="mt-3 flex min-h-6 flex-wrap gap-1.5">
				<UBadge v-for="tag in visibleTags" :key="tag" color="neutral" variant="soft">
					{{ tag }}
				</UBadge>
			</div>
			<div class="mt-4 grid grid-cols-4 gap-2 text-sm">
				<div v-for="metric in metrics" :key="metric.label" class="min-w-0">
					<p class="truncate text-xs text-muted-foreground">{{ metric.label }}</p>
					<p class="truncate font-semibold tabular-nums text-highlighted">{{ metric.value }}</p>
				</div>
			</div>
			<div class="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
				<TablerIcon name="clock" class="size-4" />
				<span>{{ updatedLabel }}</span>
				<NuxtTime :datetime="mod.dateUpdated" relative />
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
import type { ModSummary } from '~/types/mod'
import { getVisibleModTags, isEssentialsModTag } from '~/utils/modExplorer'

const props = defineProps<{
	mod: ModSummary
	versionLabel: string
	sizeLabel: string
	downloadsLabel: string
	ratingLabel: string
	updatedLabel: string
	openModioLabel: string
	unavailableLabel: string
}>()

const { locale } = useI18n()
const compactFormat = computed(
	() => new Intl.NumberFormat(locale.value, { notation: 'compact', maximumFractionDigits: 1 }),
)
const percentFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }),
)
const sizeFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }),
)
const visibleTags = computed(() => getVisibleModTags(props.mod.tags))
const essentialsTag = computed(() => props.mod.tags.find(isEssentialsModTag))

const metrics = computed(() => [
	{ label: props.versionLabel, value: props.mod.version ?? props.unavailableLabel },
	{
		label: props.sizeLabel,
		value:
			props.mod.fileSize == null
				? props.unavailableLabel
				: sizeFormat.value.format(props.mod.fileSize / 1_000_000),
	},
	{ label: props.downloadsLabel, value: compactFormat.value.format(props.mod.downloads) },
	{
		label: props.ratingLabel,
		value:
			props.mod.rating == null
				? props.unavailableLabel
				: percentFormat.value.format(props.mod.rating / 100),
	},
])

</script>
