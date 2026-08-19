<template>
	<article
		class="group h-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 p-4 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1"
	>
		<NuxtLink
			:to="`/level/${level.xxHash}`"
			class="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			@click.capture="beginTransition"
		>
			<div
				class="aspect-video overflow-hidden rounded-lg bg-muted"
				:style="transition.sourceStyle(transitionScope, 'level', level.xxHash, 'media')"
				data-shared-transition-source="media"
			>
				<NuxtImg
					v-if="level.imageUrl"
					:src="level.imageUrl"
					:alt="level.name"
					format="avif"
					width="1600"
					height="900"
					sizes="100vw sm:50vw xl:33vw 2xl:25vw"
					class="size-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
					loading="lazy"
				/>
			</div>
		</NuxtLink>
		<NuxtLink
			:to="`/level/${level.xxHash}`"
			class="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			@click.capture="beginTransition"
		>
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
			<div class="mt-4 grid grid-cols-4 gap-2 text-sm">
				<div class="min-w-0">
					<p class="text-xs text-muted-foreground">{{ pointsLabel }}</p>
					<p class="font-semibold tabular-nums text-highlighted">
						{{ level.points == null ? unavailableLabel : formatNumber(level.points) }}
					</p>
				</div>
				<div class="min-w-0">
					<p class="text-xs text-muted-foreground">{{ recordsLabel }}</p>
					<p class="font-semibold tabular-nums text-highlighted">
						{{ level.recordCount == null ? unavailableLabel : formatNumber(level.recordCount) }}
					</p>
				</div>
				<div class="min-w-0">
					<p class="text-xs text-muted-foreground">{{ personalBestsLabel }}</p>
					<p class="font-semibold tabular-nums text-highlighted">
						{{
							level.personalBestCount == null
								? unavailableLabel
								: formatNumber(level.personalBestCount)
						}}
					</p>
				</div>
				<div class="min-w-0">
					<p class="text-xs text-muted-foreground">{{ ratingLabel }}</p>
					<p class="font-semibold tabular-nums text-highlighted">
						{{
							isLevelRatingAvailable(level.rating, level.voteCount)
								? ratingFormat.format(level.rating)
								: unavailableLabel
						}}
					</p>
				</div>
			</div>
			<div
				v-if="bestTime != null && bestTimeLabel"
				class="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
				:class="{
					'border-primary/25 bg-primary/10': isWorldRecord,
					'border-purple-500/25 bg-purple-500/10': !isWorldRecord
				}"
			>
				<div class="min-w-0">
					<p
						class="text-xs font-semibold uppercase tracking-wide"
						:class="{
							'text-primary': isWorldRecord,
							'text-purple-700 dark:text-purple-300': !isWorldRecord
						}"
					>{{ bestTimeLabel }}</p>
					<p v-if="bestTimeAuthor" class="truncate text-xs text-muted-foreground">
						{{ byLabel ? `${byLabel} ${bestTimeAuthor}` : bestTimeAuthor }}
					</p>
				</div>
				<p class="shrink-0 font-bold tabular-nums text-highlighted">{{ formatTime(bestTime) }}</p>
			</div>
			<div
				v-if="createdLabel"
				class="mt-4 flex items-center gap-2 text-xs text-muted-foreground"
			>
				<TablerIcon name="clock" class="size-4" />
				<span>{{ createdLabel }}</span>
				<NuxtTime :datetime="level.dateCreated" relative />
			</div>
		</NuxtLink>
		<div class="mt-4 flex items-center gap-2">
			<PlaylistAddButton :level="level" block class="min-w-0 flex-1" />
			<FavouriteLevelButton :level="level" />
		</div>
	</article>
</template>

<script setup vapor lang="ts">
import type { LevelSummary } from '~/types/app'
import { getNumberFormatter } from '~/utils/intlFormatters'
import { createLevelRatingFormatter, isLevelRatingAvailable } from '~/utils/levelRating'

const props = defineProps<{
	level: LevelSummary
	transitionScope: string
	adventureLabel: string
	pointsLabel: string
	recordsLabel: string
	personalBestsLabel: string
	ratingLabel: string
	unavailableLabel: string
	worldRecordLabel?: string
	authorTimeLabel?: string
	byLabel?: string
	createdLabel?: string
}>()

const { locale } = useI18n()
const transition = useSharedViewTransition()
const numberFormat = computed(() => getNumberFormatter(locale.value))
const ratingFormat = computed(() => createLevelRatingFormatter(locale.value))
const bestTime = computed(() => props.level.worldRecordTime ?? props.level.medals?.author)
const bestTimeAuthor = computed(() => props.level.worldRecordAuthorName ?? props.level.authorName)
const bestTimeLabel = computed(() =>
	props.level.worldRecordTime == null ? props.authorTimeLabel : props.worldRecordLabel,
)
const isWorldRecord = computed(() => props.level.worldRecordTime != null)

function beginTransition(event: MouseEvent) {
	transition.begin({
		event,
		entity: 'level',
		entityId: props.level.xxHash,
		scope: props.transitionScope,
		targetRoute: `/level/${props.level.xxHash}`,
		preview: {
			title: props.level.name,
			subtitle: props.level.authorName,
			mediaUrl: props.level.imageUrl,
			mediaAlt: props.level.name,
			metric:
				props.level.worldRecordTime == null
					? null
					: formatTime(props.level.worldRecordTime),
		},
	})
}

function formatNumber(value: number) {
	return numberFormat.value.format(value)
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
