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
			<template v-if="user && summary">
				<div class="space-y-8 lg:space-y-10">
				<UserDetailHero :user="summary" :profile-url="profileUrl" :workshop-url="workshopProfileUrl" :labels="heroLabels" />

				<div class="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
					<div class="min-w-0 space-y-8 lg:space-y-10">
					<section aria-labelledby="profile-history">
						<SectionHeader id="profile-history" :title="$t('users.profile.history.title')" :description="$t('users.profile.history.description')" />
						<DataState :pending="pointsHistoryPending" :error="data.pointsHistoryQuery.error.value?.message" :empty="data.pointsHistory.value.length === 0" v-bind="stateLabels">
							<UserCareerHistory
								:history="data.pointsHistory.value"
								:secondary-history="data.secondaryPointsHistory.value"
								:secondary-ready="data.secondaryPointsHistoryReady.value"
								:labels="historyLabels"
							/>
						</DataState>
					</section>

				<div>
					<UserResultsSection
						id="profile-world-records"
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
						show-points
						@update:sort="data.setWrSort"
						@first="data.wrPagination.first()"
						@previous="data.wrPagination.previous(data.wrPage.value)"
						@next="data.wrPagination.next(data.wrPage.value)"
						@last="data.wrPagination.last()"
					/>
				</div>

				<section :ref="data.statisticsTarget" aria-labelledby="profile-telemetry">
					<SectionHeader id="profile-telemetry" :title="$t('users.profile.telemetry.title')" :description="$t('users.profile.telemetry.description')">
						<RecordTelemetryPeriodSelect v-model="data.telemetryPeriod.value" :label="$t('users.profile.telemetry.period')" :items="telemetryPeriodOptions" />
					</SectionHeader>
					<DataState :pending="!data.statisticsActive.value || data.statistics.fetching.value" :error="data.statistics.error.value?.message" v-bind="stateLabels">
						<RecordTelemetryPanel :model="telemetryModel" :description="$t('users.profile.telemetry.telemetryDescription')" />
					</DataState>
				</section>

				<div :ref="data.personalBestsTarget">
					<UserResultsSection
						id="profile-personal-bests"
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
						show-points
						@update:sort="data.setPbSort"
						@first="data.pbPagination.first()"
						@previous="data.pbPagination.previous(data.pbPage.value)"
						@next="data.pbPagination.next(data.pbPage.value)"
						@last="data.pbPagination.last()"
					/>
				</div>

				<div :ref="data.levelsTarget">
					<UserLevelCollection
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
					/>
				</div>

				<div :ref="data.recentTarget">
					<UserResultsSection
						id="profile-recent"
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
						:show-rank="false"
						show-pb-or-wr
						@first="data.recentPagination.first()"
						@previous="data.recentPagination.previous(data.recentPage.value)"
						@next="data.recentPagination.next(data.recentPage.value)"
						@last="data.recentPagination.last()"
					/>
				</div>

				<UserLevelCollection
					id="profile-recent-levels"
					:title="$t('users.profile.levels.recentTitle')"
					:description="$t('users.profile.levels.recentDescription')"
					:action-label="$t('users.profile.levels.viewAll')"
					:action-to="levelsUrl"
					:records-label="$t('common.records')"
					:levels="data.recentLevels.value"
					:pending="levelsPending"
					:error="data.levelsQuery.error.value?.message"
					:labels="levelCollectionLabels"
				/>
					</div>

					<aside class="space-y-8 lg:space-y-10">
						<section aria-labelledby="profile-summary">
							<SectionHeader id="profile-summary" :title="$t('users.profile.summary.title')" :description="$t('users.profile.summary.description')" />
							<MetricGrid :metrics="metrics" :columns="2" />
						</section>

						<UserSuperLeaguePanel
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
					</aside>
				</div>
				</div>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const steamId = computed(() => String(route.params.steamid))
const data = useUserProfile(steamId)
const user = data.user
await data.prefetchCritical()
const summary = data.summary
const profilePending = computed(
	() => data.profile.fetching.value && data.profile.data.value === undefined,
)
const pointsHistoryPending = computed(
	() =>
		data.pointsHistoryQuery.fetching.value &&
		data.pointsHistoryQuery.data.value === undefined,
)
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const profileUrl = computed(() => steamProfileUrl(steamId.value))
const workshopProfileUrl = computed(() => steamWorkshopProfileUrl(steamId.value))
const levelsUrl = computed(() => `/levels?author=${steamId.value}`)
const telemetryModel = useRecordTelemetryModel(data.selectedStatistics, 'user')

useSeoMeta({
	title: () =>
		user.value
			? `${user.value.steamName ?? steamId.value} · ZeepCentraal`
			: t('pages.users.seo.title'),
	description: () =>
		user.value
			? t('users.profile.seoDescription', { name: user.value.steamName ?? steamId.value })
			: t('pages.users.seo.description'),
})
const metrics = computed(() => [
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
const achievementPreviews = computed(() => [
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
const cosmeticsPreview = computed(() => ({
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
	const month = new Intl.DateTimeFormat(locale.value, {
		month: 'long',
		timeZone: USER_TELEMETRY_TIME_ZONE,
	}).format(new Date(window.monthSince))
	const year = new Intl.DateTimeFormat(locale.value, {
		year: 'numeric',
		timeZone: USER_TELEMETRY_TIME_ZONE,
	}).format(new Date(window.now))
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
	emptyValue: t('pages.records.table.notRanked'),
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
	user: t('common.user'),
	level: t('common.level'),
	time: t('common.time'),
	points: t('common.points'),
	pbOrWr: t('levels.detail.recordTable.pbOrWr'),
	personalBest: t('levels.detail.recordTable.personalBest'),
	worldRecord: t('levels.card.worldRecord'),
	openRecord: t('pages.records.table.openRecord', { level: t('common.level') }),
	date: t('common.date'),
	error: t('common.error'),
	empty: t('common.empty'),
}))
const resultSortOptions = computed(() => [
	{ label: t('users.sort.valuable'), value: 'valuable' },
	{ label: t('users.sort.recent'), value: 'recent' },
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
const levelsPending = computed(() => !data.levelsActive.value || data.levelsQuery.fetching.value)
const wrPending = computed(
	() =>
		data.wrResult.value.fetching.value && data.wrResult.value.data.value === undefined,
)
const pbPending = computed(
	() => !data.personalBestsActive.value || data.pbResult.value.fetching.value,
)
const recentPending = computed(() => !data.recentActive.value || data.recent.fetching.value)
</script>
