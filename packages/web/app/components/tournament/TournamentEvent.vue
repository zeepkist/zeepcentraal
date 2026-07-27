<template>
	<DataState
		:pending="result.fetching.value && !tournament"
		:error="result.error.value?.message"
		:empty="!result.fetching.value && !tournament"
		:loading-label="$t('common.loading')"
		:error-title="$t('common.error')"
		:empty-title="$t('tournaments.notFound')"
		class="space-y-10"
	>
		<template v-if="tournament">
			<TournamentCountdown
				v-if="future"
				:title="title"
				:start-at="tournament.startAt"
				:back-to="tournamentPath(type)"
			/>
			<template v-else>
				<section
					class="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-sm shadow-primary/5 sm:p-7 lg:p-9"
				>
					<div class="relative">
						<div class="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:items-center">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<UBadge color="primary" variant="soft">{{ title }}</UBadge>
									<UBadge color="neutral" variant="soft">{{ periodLabel }}</UBadge>
									<UBadge v-if="active" color="success" variant="soft">
										{{ $t('tournaments.live') }}
									</UBadge>
									<UBadge v-else color="neutral" variant="soft">
										{{ $t('tournaments.finalized') }}
									</UBadge>
								</div>
								<h1 class="mt-4 text-balance text-4xl font-black tracking-tight text-highlighted sm:text-5xl">
									{{ tournament.level.name }}
								</h1>
								<p v-if="tournament.level.authorName" class="mt-2 text-lg text-muted">
									{{ $t('tournaments.byAuthor', { author: tournament.level.authorName }) }}
								</p>
								<div class="mt-7 flex flex-wrap items-center gap-3">
									<UButton
										:to="`/level/${tournament.level.xxHash}`"
										icon="i-tabler-external-link"
										size="lg"
									>
										{{ $t('tournaments.openLevel') }}
									</UButton>
									<TournamentPlaylistActions :type="type" :slug="tournament.slug" :format-name="title" />
								</div>
							</div>

							<div class="w-full overflow-hidden rounded-2xl border border-border/70 bg-default/70 shadow-lg">
								<NuxtImg
									v-if="tournament.level.imageUrl"
									:src="tournament.level.imageUrl"
									:alt="tournament.level.name"
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

						<div class="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							<StatCard
								:label="$t('tournaments.competitors')"
								:value="numberFormat.format(totalCount)"
								icon="users-group"
							/>
							<StatCard :label="$t('tournaments.startDate')" icon="calendar-event">
								<template #value>
									<NuxtTime
										:datetime="tournament.startAt"
										class="whitespace-nowrap text-lg leading-tight 2xl:text-xl"
										date-style="short"
										time-style="short"
									/>
								</template>
							</StatCard>
							<StatCard :label="$t('tournaments.endDate')" icon="calendar-check">
								<template #value>
									<NuxtTime
										:datetime="tournament.endAt"
										class="whitespace-nowrap text-lg leading-tight 2xl:text-xl"
										date-style="short"
										time-style="short"
									/>
								</template>
							</StatCard>
							<StatCard
								:label="active ? $t('tournaments.timeRemaining') : $t('tournaments.endedAt')"
								icon="hourglass"
							>
								<template #value>
									<NuxtTime :datetime="tournament.endAt" relative />
								</template>
							</StatCard>
						</div>
					</div>
				</section>

				<section v-if="podium.length" class="space-y-4">
					<SectionHeader
						:title="$t('tournaments.podium')"
						:description="$t('tournaments.podiumDescription')"
					/>
					<div class="grid gap-4 md:grid-cols-3">
						<NuxtLink
							v-for="entry in podium"
							:key="entry.userId"
							:to="`/record/${entry.recordId}`"
							class="rounded-2xl border border-border bg-card/70 p-5 transition hover:border-primary/50"
						>
							<div class="flex items-center justify-between gap-3">
								<span class="text-3xl font-black text-primary">#{{ entry.rank }}</span>
								<span class="font-black tabular-nums">{{ formatTournamentTime(entry.time) }}</span>
							</div>
							<p class="mt-3 truncate font-bold text-highlighted">
								{{ entry.steamName ?? entry.steamId ?? $t('tournaments.unknownPlayer') }}
							</p>
							<div class="mt-3 flex items-end justify-between gap-3 text-sm text-muted">
								<span>{{ $t('tournaments.pointsValue', { points: entry.points }) }}</span>
								<span class="text-right text-xs">
									<template v-if="entry.setAt">
										{{ $t('common.set') }}
										<NuxtTime v-if="active" :datetime="entry.setAt" relative />
										<NuxtTime
											v-else
											:datetime="entry.setAt"
											date-style="medium"
											time-style="short"
										/>
									</template>
									<template v-else>{{ $t('common.unavailable') }}</template>
								</span>
							</div>
						</NuxtLink>
					</div>
				</section>

				<section class="space-y-4">
					<div class="flex flex-wrap items-end justify-between gap-4">
						<SectionHeader
							:title="$t('tournaments.leaderboard')"
							:description="$t('tournaments.leaderboardDescription')"
						/>
						<div v-if="active" class="flex items-center gap-2">
							<UBadge :color="liveEnabled ? 'success' : 'neutral'" variant="soft">
								{{ liveEnabled ? $t('tournaments.liveUpdates') : $t('tournaments.livePaused') }}
							</UBadge>
							<UButton
								color="neutral"
								variant="soft"
								:icon="sounds.enabled.value ? 'i-tabler-volume' : 'i-tabler-volume-off'"
								@click="sounds.setEnabled(!sounds.enabled.value)"
							>
								{{ sounds.enabled.value ? $t('tournaments.soundOn') : $t('tournaments.soundOff') }}
							</UButton>
						</div>
					</div>
					<DataState
						:pending="pagination.isInitialPending(result.fetching.value, standings.length)"
						:error="result.error.value?.message"
						:empty="standings.length === 0"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('tournaments.noResults')"
					>
						<TournamentLeaderboardTable
							:standings="standings"
							:viewer-user-id="viewerId"
							:fastest-time="podium[0]?.time"
							:active="active"
						/>
					</DataState>
					<CursorPagination
						:page="page"
						:can-go-previous="pagination.canGoPrevious(page)"
						:can-go-next="pagination.canGoNext(page)"
						:pending="result.fetching.value"
						v-bind="paginationLabels"
						@first="pagination.first()"
						@previous="pagination.previous(page)"
						@next="pagination.next(page)"
						@last="pagination.last()"
					/>
				</section>

				<TournamentGhostExplorer :standings="updateFeed" :level-id="tournament.level.id" />
			</template>
			<TournamentNavigation
				v-if="detailPage && !navigationResult.fetching.value"
				:type="type"
				:navigation="navigation"
			/>
		</template>
	</DataState>
</template>

<script setup vapor lang="ts">
import type { TrackTournamentType } from '~/types/tournament'
import {
	formatTournamentPeriod,
	formatTournamentTime,
	tournamentPath,
} from '~/utils/tournament'

const props = defineProps<{
	type: TrackTournamentType
	slug: string
	title: string
	detailPage?: boolean
}>()
const { locale, t } = useI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const slug = computed(() => props.slug)
const {
	active,
	liveEnabled,
	navigation,
	navigationResult,
	page,
	pagination,
	podium,
	prefetch,
	result,
	standings,
	totalCount,
	tournament,
	updateFeed,
} = useTrackTournamentDetail(props.type, slug, viewerId, props.detailPage ?? false)
await prefetch()

if (props.detailPage && !result.fetching.value && !tournament.value) {
	throw createError({ statusCode: 404, statusMessage: t('tournaments.notFound') })
}

watchEffect(() => {
	if (!props.detailPage || result.fetching.value || result.data.value === undefined) return
	if (!tournament.value) {
		showError(createError({ statusCode: 404, statusMessage: t('tournaments.notFound') }))
	}
})

const future = computed(() =>
	Boolean(tournament.value && Date.parse(tournament.value.startAt) > Date.now()),
)
const numberFormat = computed(() => getNumberFormatter(locale.value))
const periodLabel = computed(() =>
	tournament.value
		? formatTournamentPeriod(tournament.value.type, tournament.value.slug, locale.value, (period) =>
				t('tournaments.weeklyPeriod', period),
			)
		: '',
)
const sounds = useTournamentNotificationSounds(updateFeed, liveEnabled)
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))

useSeoMeta({
	title: () =>
		tournament.value ? `${tournament.value.level.name} · ${props.title}` : props.title,
	description: () => t('tournaments.seoDescription', { title: props.title }),
	robots: () => (future.value ? 'noindex, nofollow' : 'index, follow'),
})
</script>
