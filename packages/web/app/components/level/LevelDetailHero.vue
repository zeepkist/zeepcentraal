<template>
	<section
		class="level-hero relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-sm shadow-primary/5 sm:p-7 lg:p-9"
	>
		<div
			class="relative grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:items-stretch"
		>
			<div class="flex min-w-0 flex-col justify-center">
				<UBadge v-if="level.adventure" class="w-fit" color="primary" variant="soft">
					{{ labels.adventure }}
				</UBadge>

				<h1 class="mt-4 text-balance text-4xl font-black tracking-tight text-highlighted md:text-6xl">
					{{ level.name }}
				</h1>
				<NuxtLink
					v-if="level.publiclyVisible && level.authorId"
					:to="`/user/${level.authorId}`"
					class="mt-3 inline-flex w-fit items-center gap-2 text-lg text-muted-foreground transition hover:text-primary"
				>
					<TablerIcon name="user" class="size-5" />
					{{ level.authorName ?? labels.unknownAuthor }}
				</NuxtLink>
				<p v-else-if="level.publiclyVisible" class="mt-3 text-lg text-muted-foreground">
					{{ level.authorName ?? labels.unknownAuthor }}
				</p>

				<div class="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
					<div
						v-for="metric in metrics"
						:key="metric.label"
						class="rounded-xl border border-border/70 bg-default/55 px-4 py-3 backdrop-blur"
					>
						<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							{{ metric.label }}
						</p>
						<p class="mt-1 text-xl font-black tabular-nums text-highlighted">
							{{ metric.value }}
						</p>
					</div>
				</div>

				<div class="mt-7 flex flex-wrap items-center gap-3">
					<UButton
						v-if="level.publiclyVisible && workshopUrl"
						:to="workshopUrl"
						target="_blank"
						rel="noopener"
						color="primary"
						size="lg"
						icon="i-tabler-brand-steam"
						trailing-icon="i-tabler-external-link"
					>
						{{ labels.workshopAction }}
					</UButton>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<TablerIcon name="calendar" class="size-4" />
						<span>{{ labels.published }}</span>
						<NuxtTime :datetime="level.dateCreated" relative />
					</div>
				</div>
			</div>

			<div class="flex min-w-0 flex-col gap-4">
				<div
					v-if="level.publiclyVisible"
					class="w-full overflow-hidden rounded-2xl border border-border/70 bg-default/70 shadow-lg"
					:style="transition.targetStyle('level', transitionId, 'media')"
					data-shared-transition-target="media"
				>
					<NuxtImg
						v-if="level.imageUrl"
						:src="level.imageUrl"
						:alt="level.name"
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

				<div
					v-if="worldRecord"
					class="w-full rounded-2xl border border-primary/25 bg-default/80 p-4 shadow-sm"
				>
					<div class="flex flex-wrap items-center gap-3 sm:flex-nowrap">
						<span
							class="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"
						>
							<TablerIcon name="trophy" class="size-6" />
						</span>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-bold uppercase tracking-[0.16em] text-primary">
								{{ labels.worldRecord }}
							</p>
							<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
								<NuxtLink
									v-if="worldRecord.userSteamId"
									:to="`/user/${worldRecord.userSteamId}`"
									class="inline-flex max-w-full items-center gap-1.5 truncate font-semibold transition hover:text-primary"
								>
									<TablerIcon name="user-star" class="size-4 shrink-0" />
									<span class="truncate">{{ worldRecord.userName ?? labels.unknownAuthor }}</span>
								</NuxtLink>
								<span v-else class="truncate font-semibold">
									{{ worldRecord.userName ?? labels.unknownAuthor }}
								</span>
								<span class="inline-flex items-center gap-1.5">
									<TablerIcon name="calendar-event" class="size-4 shrink-0" />
									{{ labels.worldRecordSet }}
									<NuxtTime :datetime="worldRecord.dateCreated" relative />
								</span>
							</div>
						</div>
						<NuxtLink
							:to="`/record/${worldRecord.recordId}`"
							class="shrink-0 rounded-xl border border-primary/20 bg-default/65 px-3 py-2 text-3xl font-black tabular-nums text-highlighted shadow-sm transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							{{ formatTime(worldRecord.time) }}
						</NuxtLink>
					</div>
				</div>
				<div
					v-else
					class="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-border bg-linear-to-r from-default/80 to-primary/5 p-4 text-muted-foreground shadow-sm"
				>
					<span class="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
						<TablerIcon name="trophy" class="size-5" />
					</span>
					<div>
						<p class="font-semibold text-highlighted">{{ labels.noWorldRecordTitle }}</p>
						<p class="mt-0.5 text-sm">{{ labels.noWorldRecordDescription }}</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import type { LevelSummary, LevelWorldRecordSummary } from '~/types/app'
import { getNumberFormatter } from '~/utils/intlFormatters'
import { isLevelRatingAvailable } from '~/utils/levelRating'

const props = defineProps<{
	level: LevelSummary
	transitionId: string
	worldRecord?: LevelWorldRecordSummary | null
	workshopUrl?: string
	labels: {
		adventure: string
		published: string
		unknownAuthor: string
		points: string
		rating: string
		records: string
		personalBests: string
		trackLength: string
		unavailable: string
		worldRecord: string
		worldRecordSet: string
		noWorldRecordTitle: string
		noWorldRecordDescription: string
		workshopAction: string
	}
}>()

const { locale } = useI18n()
const transition = useSharedViewTransition()
const numberFormat = computed(() => getNumberFormatter(locale.value))
const percentFormat = computed(() => getNumberFormatter(locale.value, 'percent-one-decimal'))
const distanceFormat = computed(() => getNumberFormatter(locale.value, 'one-decimal'))
const metrics = computed(() => [
	{ label: props.labels.points, value: formatNumber(props.level.points) },
	{
		label: props.labels.rating,
		value: formatRating(props.level.rating, props.level.voteCount),
	},
	{ label: props.labels.records, value: formatNumber(props.level.recordCount) },
	{ label: props.labels.personalBests, value: formatNumber(props.level.personalBestCount) },
	{ label: props.labels.trackLength, value: formatDistance(props.level.trackLength) },
])

function formatNumber(value: number | null | undefined) {
	return value == null ? props.labels.unavailable : numberFormat.value.format(value)
}

function formatRating(value: number | null | undefined, voteCount: number | undefined) {
	return isLevelRatingAvailable(value, voteCount)
		? percentFormat.value.format(value)
		: props.labels.unavailable
}

function formatDistance(value: number | null | undefined) {
	if (value == null) return props.labels.unavailable
	if (value >= 1000) return `${distanceFormat.value.format(value / 1000)} km`
	return `${distanceFormat.value.format(value)} m`
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
