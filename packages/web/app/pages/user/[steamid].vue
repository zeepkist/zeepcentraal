<template>
	<UContainer class="py-2">
		<DataState
			:pending="profilePending"
			:error="data.profile.error.value?.message"
			:empty="!data.profile.fetching.value && !user"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('users.profile.notFound')"
		>
			<template #pending>
				<SharedDetailPreview
					v-if="transitionPreview"
					entity="user"
					:entity-id="steamId"
					:preview="transitionPreview"
				/>
				<div v-else class="space-y-3">
					<USkeleton v-for="index in 4" :key="index" class="h-24 rounded-xl" />
				</div>
			</template>
			<template v-if="user && summary">
				<div class="space-y-8 lg:space-y-10">
					<UserDetailHero
						:user="summary"
						:profile-url="profileUrl"
						:workshop-url="workshopProfileUrl"
						:labels="heroLabels"
					/>

					<DetailSectionTabs
						v-model="activeTab"
						:items="profileTabs"
						:label="$t('users.profile.tabs.label')"
					>
						<template #career>
							<div
								:ref="data.careerTarget"
								class="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start"
							>
								<div class="min-w-0 space-y-8 lg:space-y-10">
									<section aria-labelledby="profile-history">
										<SectionHeader
											id="profile-history"
											:title="$t('users.profile.history.title')"
											:description="$t('users.profile.history.description')"
										/>
										<DataState
											:pending="pointsHistoryPending"
											:error="data.pointsHistoryQuery.error.value?.message"
											:empty="data.pointsHistory.value.length === 0"
											v-bind="stateLabels"
										>
											<template #pending>
												<div class="grid gap-4">
													<USkeleton
														v-for="index in 2"
														:key="index"
														class="h-[254px] w-full rounded-2xl"
													/>
												</div>
											</template>
											<LazyUserCareerHistory
												:history="data.pointsHistory.value"
												:secondary-history="data.secondaryPointsHistory.value"
												:secondary-pending="
													data.careerSecondaryActive.value &&
													!data.secondaryPointsHistoryReady.value
												"
												:secondary-ready="data.secondaryPointsHistoryReady.value"
												:labels="historyLabels"
												@activate-secondary="data.activateCareerSecondary"
											/>
										</DataState>
									</section>

									<section
										:ref="data.statisticsTarget"
										aria-labelledby="profile-telemetry"
									>
										<SectionHeader
											id="profile-telemetry"
											:title="$t('users.profile.telemetry.title')"
											:description="$t('users.profile.telemetry.description')"
										>
											<RecordTelemetryPeriodSelect
												v-model="data.telemetryPeriod.value"
												:label="$t('users.profile.telemetry.period')"
												:items="telemetryPeriodOptions"
											/>
										</SectionHeader>
										<DataState
											:pending="!data.statisticsActive.value || data.statistics.fetching.value"
											:error="data.statistics.error.value?.message"
											v-bind="stateLabels"
										>
											<template #pending>
												<USkeleton class="min-h-80 w-full rounded-2xl" />
											</template>
											<LazyRecordTelemetryPanel
												:model="telemetryModel"
												:description="$t('users.profile.telemetry.telemetryDescription')"
											/>
										</DataState>
									</section>
								</div>

								<aside class="space-y-8 lg:space-y-10">
									<section aria-labelledby="profile-summary">
										<SectionHeader
											id="profile-summary"
											:title="$t('users.profile.summary.title')"
											:description="$t('users.profile.summary.description')"
										/>
										<MetricGrid :metrics="metrics" :columns="2" />
									</section>

									<LazyUserSuperLeaguePanel
										id="profile-super-league"
										:selected-season-id="data.selectedSuperLeagueSeasonId.value"
										:seasons="superLeagueSeasonOptions"
										:season="data.superLeagueSeason.value"
										:standings-to="superLeagueStandingsUrl"
										:pending="superLeaguePending"
										:error="superLeagueError"
										:labels="superLeagueLabels"
										@update:selected-season-id="data.selectedSuperLeagueSeasonId.value = $event"
									/>

									<UserAchievementShowcase
										id="profile-achievements"
										:achievements="achievementPreviews"
										:labels="achievementLabels"
									/>

									<UserCosmeticsShowcase
										id="profile-cosmetics"
										:progress="cosmeticsPreview"
										:labels="cosmeticsLabels"
									/>

									<section aria-labelledby="profile-voting-distribution">
										<SectionHeader
											id="profile-voting-distribution"
											:title="$t('users.profile.votingDistribution.title')"
											:description="$t('users.profile.votingDistribution.description')"
										/>
										<div class="rounded-xl border border-border bg-card/70 p-4">
											<VoteDistributionChart
												:counts="data.voteDistribution.value"
												:labels="votingDistributionLabels"
											/>
										</div>
									</section>
								</aside>
							</div>
						</template>

						<template #records>
							<div class="space-y-8 lg:space-y-10">
								<LazyUserResultsSection
									id="profile-world-records"
									transition-scope="user-world-records"
									:title="$t('users.profile.worldRecords.title')"
									:description="$t('users.profile.worldRecords.description')"
									:records="data.wrRows.value"
									:sort="data.wrSort.value"
									:pending="wrPending"
									:error="data.wrResult.value.error.value?.message"
									:page="data.wrPage.value"
									:can-go-previous="data.wrPagination.canGoPrevious(data.wrPage.value)"
									:can-go-next="data.wrPagination.canGoNext(data.wrPage.value)"
									:labels="resultLabels"
									:sort-label="$t('levels.filters.sort')"
									:sort-options="resultSortOptions"
									:pagination-labels="paginationLabels"
									status-mode="none"
									@update:sort="data.setWrSort"
									@first="data.wrPagination.first()"
									@previous="data.wrPagination.previous(data.wrPage.value)"
									@next="data.wrPagination.next(data.wrPage.value)"
									@last="data.wrPagination.last()"
								/>

								<div :ref="data.personalBestsTarget">
									<LazyUserResultsSection
										id="profile-personal-bests"
										transition-scope="user-personal-bests"
										:title="$t('users.profile.personalBests.title')"
										:description="$t('users.profile.personalBests.description')"
										:records="data.pbRows.value"
										:sort="data.pbSort.value"
										:sort-label="$t('levels.filters.sort')"
										:pending="pbPending"
										:error="data.pbResult.value.error.value?.message"
										:page="data.pbPage.value"
										:can-go-previous="data.pbPagination.canGoPrevious(data.pbPage.value)"
										:can-go-next="data.pbPagination.canGoNext(data.pbPage.value)"
										:labels="resultLabels"
										:sort-options="resultSortOptions"
										:pagination-labels="paginationLabels"
										status-mode="world-record-only"
										@update:sort="data.setPbSort"
										@first="data.pbPagination.first()"
										@previous="data.pbPagination.previous(data.pbPage.value)"
										@next="data.pbPagination.next(data.pbPage.value)"
										@last="data.pbPagination.last()"
									/>
								</div>

								<div :ref="data.recentTarget">
									<LazyUserResultsSection
										id="profile-recent"
										transition-scope="user-recent-records"
										:title="$t('users.profile.recent.title')"
										:description="$t('users.profile.recent.description')"
										:records="data.recentRows.value"
										:pending="recentPending"
										:error="data.recent.error.value?.message"
										:page="data.recentPage.value"
										:can-go-previous="data.recentPagination.canGoPrevious(data.recentPage.value)"
										:can-go-next="data.recentPagination.canGoNext(data.recentPage.value)"
										:labels="resultLabels"
										:pagination-labels="paginationLabels"
										status-mode="all"
										@first="data.recentPagination.first()"
										@previous="data.recentPagination.previous(data.recentPage.value)"
										@next="data.recentPagination.next(data.recentPage.value)"
										@last="data.recentPagination.last()"
									/>
								</div>
							</div>
						</template>

						<template #workshop>
							<div class="space-y-8 lg:space-y-10">
								<div :ref="data.levelsTarget">
									<LazyUserLevelCollection
										id="profile-popular-levels"
										:title="$t('users.profile.levels.popularTitle')"
										:description="$t('users.profile.levels.popularDescription')"
										:action-label="$t('users.profile.levels.viewAll')"
										:action-to="levelsUrl"
										:records-label="$t('common.records')"
										:levels="data.popularLevels.value"
										:pending="levelsPending"
										:error="data.levelsQuery.error.value?.message"
										:labels="levelCollectionLabels"
										transition-scope="user-popular-levels"
									/>
								</div>

								<LazyUserLevelCollection
									id="profile-recent-levels"
									:title="$t('users.profile.levels.recentTitle')"
									:description="$t('users.profile.levels.recentDescription')"
									:action-label="$t('users.profile.levels.viewAll')"
									:action-to="recentLevelsUrl"
									:records-label="$t('common.records')"
									:levels="data.recentLevels.value"
									:pending="levelsPending"
									:error="data.levelsQuery.error.value?.message"
									:labels="levelCollectionLabels"
									transition-scope="user-recent-levels"
								/>
							</div>
						</template>

						<template #favourites>
							<LazyUserFavouriteLevelsSection
								id="profile-favourite-levels"
								:title="$t('users.profile.favourites.title')"
								:description="$t('users.profile.favourites.description')"
								:levels="data.favouriteLevels.value"
								:pending="favouritesPending"
								:pagination-pending="data.favouritesQuery.fetching.value"
								:error="data.favouritesQuery.error.value?.message"
								:page="data.favouritesPage.value"
								:can-go-previous="data.favouritesPagination.canGoPrevious(data.favouritesPage.value)"
								:can-go-next="data.favouritesPagination.canGoNext(data.favouritesPage.value)"
								:labels="favouriteLevelLabels"
								transition-scope="user-favourite-levels"
								@first="data.favouritesPagination.first()"
								@previous="data.favouritesPagination.previous(data.favouritesPage.value)"
								@next="data.favouritesPagination.next(data.favouritesPage.value)"
								@last="data.favouritesPagination.last()"
							/>
						</template>
					</DetailSectionTabs>
				</div>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup vapor lang="ts">
import type {
	StatisticMetric,
	UserAchievementPreviewItem,
	UserCosmeticProgressPreview,
} from '~/types/app'
import { getDateTimeFormatter, getNumberFormatter } from '~/utils/intlFormatters'
import { preserveOgStringProp } from '~/utils/ogImage'

const route = useRoute()
const { t } = useI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const steamId = computed(() => String(route.params.steamid))
const ogSteamId = computed(() => preserveOgStringProp(steamId.value))
defineOgImage('UserDetail.takumi', { slug: ogSteamId })
type UserProfileTab = 'career' | 'records' | 'workshop' | 'favourites'
const activeTab = ref<UserProfileTab>('career')
const summaryData = useUserProfileSummary(steamId)
const data = useUserProfile(steamId, {
	favouritesActive: computed(() => activeTab.value === 'favourites'),
	recordsActive: computed(() => activeTab.value === 'records'),
	summary: summaryData,
	viewerId,
	workshopActive: computed(() => activeTab.value === 'workshop'),
})
const user = data.user
if (import.meta.server) await summaryData.prefetchCritical()
const summary = data.summary
const transition = useSharedViewTransition()
const transitionPreview = computed(() => transition.preview('user', steamId.value))
const profilePending = computed(
	() => data.profile.fetching.value && data.profile.data.value === undefined,
)
const pointsHistoryPending = computed(
	() =>
		!data.careerActive.value ||
		(data.pointsHistoryQuery.fetching.value &&
			data.pointsHistoryQuery.data.value === undefined),
)
const { locale } = useI18n()
const number = computed(() => getNumberFormatter(locale.value, 'one-decimal'))
const profileUrl = computed(() => steamProfileUrl(steamId.value))
const workshopProfileUrl = computed(() => steamWorkshopProfileUrl(steamId.value))
const levelsUrl = computed(() => `/levels?author=${steamId.value}`)
const recentLevelsUrl = computed(
	() => `/levels?author=${steamId.value}&sort=DATE_CREATED_DESC`,
)
const telemetryModel = useRecordTelemetryModel(data.selectedStatistics, 'user')
const profileTabs = computed<Array<{ label: string; value: UserProfileTab }>>(() => [
	{ label: t('users.profile.tabs.career'), value: 'career' },
	{ label: t('users.profile.tabs.records'), value: 'records' },
	{ label: t('users.profile.tabs.workshopLevels'), value: 'workshop' },
	{ label: t('users.profile.tabs.favouriteLevels'), value: 'favourites' },
])

useSeoMeta({
	title: () =>
		user.value
			? user.value.steamName ?? steamId.value
			: t('pages.users.seo.title'),
	description: () =>
		user.value
			? t('users.profile.seoDescription', { name: user.value.steamName ?? steamId.value })
			: t('pages.users.seo.description'),
})
const metrics = computed<StatisticMetric[]>(() => [
	{
		key: 'records',
		label: t('common.records'),
		value: number.value.format(user.value?.records.totalCount ?? 0),
		icon: 'route',
	},
	{
		key: 'pbs',
		label: t('dashboard.metrics.personalBests'),
		value: number.value.format(user.value?.personalBestGlobals.totalCount ?? 0),
		icon: 'star',
	},
	{
		key: 'wrs',
		label: t('users.columns.worldRecords'),
		value: number.value.format(user.value?.worldRecordGlobals.totalCount ?? 0),
		icon: 'trophy',
	},
	{
		key: 'levels',
		label: t('common.levels'),
		value: number.value.format(user.value?.levelItems.totalCount ?? 0),
		icon: 'map',
		to: `/levels?author=${steamId.value}`,
	},
])
const achievementPreviews = computed<UserAchievementPreviewItem[]>(() => [
	{ key: 'records', label: t('users.profile.achievements.items.records'), icon: 'route' },
	{
		key: 'personal-bests',
		label: t('users.profile.achievements.items.personalBests'),
		icon: 'star',
	},
	{
		key: 'world-records',
		label: t('users.profile.achievements.items.worldRecords'),
		icon: 'trophy',
	},
	{ key: 'fastest-speed', label: t('users.profile.achievements.items.fastestSpeed'), icon: 'gauge' },
	{ key: 'levels', label: t('users.profile.achievements.items.levels'), icon: 'map' },
	{
		key: 'super-league',
		label: t('users.profile.achievements.items.superLeague'),
		icon: 'trophy',
	},
	{ key: 'points', label: t('users.profile.achievements.items.points'), icon: 'trending-up' },
	{ key: 'driving', label: t('users.profile.achievements.items.driving'), icon: 'road' },
	{ key: 'surfaces', label: t('users.profile.achievements.items.surfaces'), icon: 'palette' },
])
const cosmeticsPreview = computed<UserCosmeticProgressPreview>(() => ({
	unlocked: null,
	total: null,
	percentage: null,
	categories: [
		{ key: 'hats', label: t('users.profile.cosmetics.categories.hats'), icon: 'hat' },
		{ key: 'glasses', label: t('users.profile.cosmetics.categories.glasses'), icon: 'glasses' },
		{
			key: 'skin-colours',
			label: t('users.profile.cosmetics.categories.skinColours'),
			icon: 'palette',
		},
		{ key: 'soapboxes', label: t('users.profile.cosmetics.categories.soapboxes'), icon: 'car' },
		{ key: 'wheels', label: t('users.profile.cosmetics.categories.wheels'), icon: 'wheel' },
	],
}))
const telemetryPeriodOptions = computed(() => {
	const window = data.telemetryWindows.value
	const month = getDateTimeFormatter(locale.value, 'month-london').format(
		new Date(window.monthSince),
	)
	const year = getDateTimeFormatter(locale.value, 'year-london').format(new Date(window.now))
	return [
		{ label: t('users.profile.telemetry.allTime'), value: 'all-time' },
		{ label: t('users.profile.telemetry.today'), value: 'today' },
		{ label: month, value: 'month' },
		{ label: year, value: 'year' },
	]
})
const superLeagueSeasonOptions = computed(() =>
	data.superLeagueSeasons.value.map((season) => ({ label: season.name, value: season.id })),
)
const superLeagueStandingsUrl = computed(() =>
	data.selectedSuperLeagueSeasonId.value == null
		? undefined
		: `/super-league/season-${data.selectedSuperLeagueSeasonId.value}`,
)
const superLeaguePending = computed(
	() =>
		(data.superLeagueSeasonsQuery.fetching.value &&
			data.superLeagueSeasonsQuery.data.value === undefined) ||
		(data.selectedSuperLeagueSeasonId.value !== undefined &&
			data.superLeagueSeasonQuery.fetching.value &&
			data.superLeagueSeasonQuery.data.value === undefined),
)
const superLeagueError = computed(
	() =>
		data.superLeagueSeasonsQuery.error.value?.message ??
		data.superLeagueSeasonQuery.error.value?.message,
)
const superLeagueLabels = computed(() => ({
	title: t('users.profile.superLeague.title'),
	description: t('users.profile.superLeague.description'),
	season: t('users.profile.superLeague.season'),
	viewStandings: t('users.profile.superLeague.viewStandings'),
	position: t('users.profile.superLeague.position'),
	points: t('users.profile.superLeague.points'),
	roundsEntered: t('users.profile.superLeague.roundsEntered'),
	roundResults: t('users.profile.superLeague.roundResults'),
	bestOf: (count: number) =>
		t('users.profile.superLeague.bestOf', { count: number.value.format(count) }),
	round: (round: number) => t('zsl.roundNumber', { round: number.value.format(round) }),
	excluded: (count: number) =>
		t('users.profile.superLeague.excluded', { count: number.value.format(count) }),
	noSeasons: t('users.profile.superLeague.noSeasons'),
	noResults: t('users.profile.superLeague.noResults'),
	loading: t('common.loading'),
	error: t('common.error'),
	emptyValue: t('common.unavailable'),
}))
const achievementLabels = computed(() => ({
	title: t('users.profile.achievements.title'),
	description: t('users.profile.achievements.description'),
	comingSoon: t('users.profile.achievements.comingSoon'),
}))
const cosmeticsLabels = computed(() => ({
	title: t('users.profile.cosmetics.title'),
	description: t('users.profile.cosmetics.description'),
	progress: t('users.profile.cosmetics.progress'),
	rarest: t('users.profile.cosmetics.rarest'),
	mostUsed: t('users.profile.cosmetics.mostUsed'),
	comingSoon: t('users.profile.cosmetics.comingSoon'),
	unavailable: t('users.profile.cosmetics.unavailable'),
}))
const votingDistributionLabels = computed(() => ({
	ariaLabel: t('users.profile.votingDistribution.ariaLabel'),
	empty: t('users.profile.votingDistribution.empty'),
	total: (count: number) =>
		t('users.profile.votingDistribution.total', {
			count: number.value.format(count),
		}),
}))
const heroLabels = computed(() => ({ eyebrow: t('users.profile.eyebrow'), joined: t('users.profile.joined'), globalRank: t('users.profile.globalRank'), rankedPoints: t('users.columns.rankedPoints'), totalPoints: t('users.columns.totalPoints'), unranked: t('users.profile.unranked'), steamProfile: t('users.profile.steamProfile'), steamWorkshop: t('users.profile.steamWorkshop') }))
const historyLabels = computed(() => ({
	rankedPoints: t('users.profile.history.rankedPoints'),
	rankedPointsDescription: t('users.profile.history.rankedPointsDescription'),
	totalPoints: t('users.profile.history.totalPoints'),
	totalPointsDescription: t('users.profile.history.totalPointsDescription'),
	rank: t('users.profile.history.rank'),
	rankDescription: t('users.profile.history.rankDescription'),
	worldRecords: t('users.profile.history.worldRecords'),
	worldRecordsDescription: t('users.profile.history.worldRecordsDescription'),
	pointsToggleLabel: t('users.profile.history.pointsToggleLabel'),
	standingToggleLabel: t('users.profile.history.standingToggleLabel'),
	loading: t('common.loading'),
}))
const resultLabels = computed(() => ({
	rank: t('common.rank'),
	level: t('common.level'),
	player: t('common.user'),
	unknownPlayer: t('common.unknownPlayer'),
	time: t('common.time'),
	delta: t('common.delta'),
	status: t('pages.records.table.status'),
	points: t('common.points'),
	pointsHelp: t('pages.records.table.pointsHelp'),
	rankedPoints: t('common.rankedPoints'),
	rankedPointsHelp: t('pages.records.table.rankedPointsHelp'),
	levelPoints: t('common.levelPoints'),
	personalBest: t('common.personalBest'),
	worldRecord: t('common.worldRecord'),
	openRecord: t('pages.records.table.openRecord', { level: t('common.level') }),
	date: t('common.set'),
	notRanked: t('common.unavailable'),
	decayPercentage: t('pages.records.table.decayPercentage'),
	error: t('common.error'),
	empty: t('common.empty'),
}))
const resultSortOptions = computed(() => [
	{ label: t('pages.records.sort.latest'), value: 'latest' as const },
	{ label: t('pages.records.sort.valuablePbs'), value: 'valuable-pbs' as const },
	{ label: t('pages.records.sort.valuableLevels'), value: 'valuable-levels' as const },
])
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
const stateLabels = computed(() => ({
	loadingLabel: t('common.loading'),
	errorTitle: t('common.error'),
	emptyTitle: t('common.empty'),
}))
const levelCollectionLabels = computed(() => ({
	loading: t('common.loading'),
	error: t('common.error'),
	empty: t('users.profile.levels.empty'),
	adventure: t('common.adventure'),
	points: t('common.points'),
	personalBests: t('levels.card.personalBests'),
	rating: t('levels.card.rating'),
	unavailable: t('levels.card.unavailable'),
	worldRecord: t('levels.card.worldRecord'),
	authorTime: t('levels.card.authorTime'),
	by: t('levels.card.by'),
	created: t('levels.card.created'),
}))
const favouriteLevelLabels = computed(() => ({
	...levelCollectionLabels.value,
	empty: t('users.profile.favourites.empty'),
	records: t('common.records'),
	pagination: t('common.pagination'),
	first: t('common.first'),
	previous: t('common.previous'),
	next: t('common.next'),
	last: t('common.last'),
}))
const levelsPending = computed(() => !data.levelsActive.value || data.levelsQuery.fetching.value)
const favouritesPending = computed(() =>
	data.favouritesPagination.isInitialPending(
		data.favouritesQuery.fetching.value,
		data.favouriteLevels.value.length,
		activeTab.value === 'favourites',
	),
)
const wrPending = computed(
	() =>
		data.wrResult.value.fetching.value && data.wrResult.value.data.value === undefined,
)
const pbPending = computed(
	() => !data.personalBestsActive.value || data.pbResult.value.fetching.value,
)
const recentPending = computed(() => !data.recentActive.value || data.recent.fetching.value)
</script>
