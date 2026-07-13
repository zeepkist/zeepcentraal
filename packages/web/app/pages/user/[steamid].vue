<template>
	<UContainer class="py-2">
		<DataState
			:pending="data.profile.fetching.value"
			:error="data.profile.error.value?.message"
			:empty="!data.profile.fetching.value && !user"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('users.profile.notFound')"
		>
			<template v-if="user && summary">
				<div class="space-y-8 lg:space-y-10">
				<UserDetailHero :user="summary" :profile-url="profileUrl" :workshop-url="workshopProfileUrl" :labels="heroLabels" />

				<section aria-labelledby="profile-summary">
					<SectionHeader id="profile-summary" :title="$t('users.profile.summary.title')" :description="$t('users.profile.summary.description')" />
					<MetricGrid :metrics="metrics" />
				</section>

				<section :ref="data.pointsHistoryTarget" aria-labelledby="profile-history">
					<SectionHeader id="profile-history" :title="$t('users.profile.history.title')" :description="$t('users.profile.history.description')" />
					<DataState :pending="!data.pointsHistoryActive.value || data.pointsHistoryQuery.fetching.value" :error="data.pointsHistoryQuery.error.value?.message" :empty="data.pointsHistory.value.length === 0" v-bind="stateLabels">
						<UserCareerHistory :history="data.pointsHistory.value" :labels="historyLabels" />
					</DataState>
				</section>

				<section :ref="data.statisticsTarget" aria-labelledby="profile-telemetry">
					<SectionHeader id="profile-telemetry" :title="$t('users.profile.telemetry.title')" :description="$t('users.profile.telemetry.description')" />
					<DataState :pending="!data.statisticsActive.value || data.statistics.fetching.value" :error="data.statistics.error.value?.message" v-bind="stateLabels">
						<RecordTelemetryPanel :model="telemetryModel" :description="$t('users.profile.telemetry.telemetryDescription')" />
					</DataState>
				</section>

				<div :ref="data.worldRecordsTarget">
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
						:sort-options="resultSortOptions"
						:pagination-labels="paginationLabels"
						@update:sort="data.setWrSort"
						@first="data.wrPagination.first()"
						@previous="data.wrPagination.previous(data.wrPage.value)"
						@next="data.wrPagination.next(data.wrPage.value)"
						@last="data.wrPagination.last()"
					/>
				</div>
				<div :ref="data.personalBestsTarget">
					<UserResultsSection
						id="profile-personal-bests"
						:title="$t('users.profile.personalBests.title')"
						:description="$t('users.profile.personalBests.description')"
						:records="data.pbRows.value"
						:sort="data.pbSort.value"
						:pending="pbPending"
						:error="data.pbResult.value.error.value?.message"
						:page="data.pbPage.value"
						:can-go-previous="data.pbPagination.canGoPrevious(data.pbPage.value)"
						:can-go-next="data.pbPagination.canGoNext(data.pbPage.value)"
						:labels="resultLabels"
						:sort-options="resultSortOptions"
						:pagination-labels="paginationLabels"
						@update:sort="data.setPbSort"
						@first="data.pbPagination.first()"
						@previous="data.pbPagination.previous(data.pbPage.value)"
						@next="data.pbPagination.next(data.pbPage.value)"
						@last="data.pbPagination.last()"
					/>
				</div>

				<section :ref="data.recentTarget" aria-labelledby="profile-recent">
					<SectionHeader id="profile-recent" :title="$t('users.profile.recent.title')" :description="$t('users.profile.recent.description')" />
					<DataState :pending="
						data.recentPagination.isInitialPending(
							data.recent.fetching.value,
							data.recentRows.value.length,
							data.recentActive.value,
						)
					" :error="data.recent.error.value?.message" :empty="data.recentRows.value.length === 0" v-bind="stateLabels">
						<UserResultTable :records="data.recentRows.value" :labels="resultLabels" />
					</DataState>
					<CursorPagination class="mt-4" :page="data.recentPage.value" :can-go-previous="data.recentPagination.canGoPrevious(data.recentPage.value)" :can-go-next="data.recentPagination.canGoNext(data.recentPage.value)" :pending="data.recent.fetching.value" v-bind="paginationLabels" @first="data.recentPagination.first()" @previous="data.recentPagination.previous(data.recentPage.value)" @next="data.recentPagination.next(data.recentPage.value)" @last="data.recentPagination.last()" />
				</section>

				<div :ref="data.levelsTarget" class="grid gap-8 2xl:grid-cols-2 2xl:items-start">
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
					<UserLevelCollection
						id="profile-popular-levels"
						:title="$t('users.profile.levels.popularTitle')"
						:description="$t('users.profile.levels.popularDescription')"
						:action-label="$t('users.profile.levels.viewAll')"
						:action-to="levelsUrl"
						:records-label="$t('users.profile.levels.recordsThisYear')"
						:levels="data.popularLevels.value"
						:pending="levelsPending"
						:error="data.levelsQuery.error.value?.message"
						:labels="levelCollectionLabels"
					/>
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
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const profileUrl = computed(() => steamProfileUrl(steamId.value))
const workshopProfileUrl = computed(() => steamWorkshopProfileUrl(steamId.value))
const levelsUrl = computed(() => `/levels?author=${steamId.value}`)
const telemetryModel = useRecordTelemetryModel(data.statistics.data, 'user')

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
		key: 'rank',
		label: t('common.rank'),
		value: user.value?.userPoints && user.value.userPoints.rank > 0 ? `#${number.value.format(user.value.userPoints.rank)}` : t('users.profile.unranked'),
		icon: 'trophy',
	},
	{
		key: 'points',
		label: t('users.columns.rankedPoints'),
		value: number.value.format(user.value?.userPoints?.points ?? 0),
		icon: 'dashboard',
	},
	{
		key: 'total',
		label: t('users.columns.totalPoints'),
		value: number.value.format(user.value?.userPoints?.totalPoints ?? 0),
		icon: 'dashboard',
	},
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
		icon: 'users',
	},
	{
		key: 'wrs',
		label: t('users.columns.worldRecords'),
		value: number.value.format(user.value?.worldRecordGlobals.totalCount ?? 0),
		icon: 'flag',
	},
	{
		key: 'levels',
		label: t('common.levels'),
		value: number.value.format(user.value?.levelItems.totalCount ?? 0),
		icon: 'map',
		to: `/levels?author=${steamId.value}`,
	},
])
const heroLabels = computed(() => ({ eyebrow: t('users.profile.eyebrow'), joined: t('users.profile.joined'), globalRank: t('users.profile.globalRank'), rankedPoints: t('users.columns.rankedPoints'), totalPoints: t('users.columns.totalPoints'), unranked: t('users.profile.unranked'), steamProfile: t('users.profile.steamProfile'), steamWorkshop: t('users.profile.steamWorkshop') }))
const historyLabels = computed(() => ({ rankedPoints: t('users.profile.history.rankedPoints'), rankedPointsDescription: t('users.profile.history.rankedPointsDescription'), totalPoints: t('users.profile.history.totalPoints'), totalPointsDescription: t('users.profile.history.totalPointsDescription'), rank: t('users.profile.history.rank'), rankDescription: t('users.profile.history.rankDescription') }))
const resultLabels = computed(() => ({
	rank: t('common.rank'),
	level: t('common.level'),
	time: t('common.time'),
	value: t('users.columns.value'),
	date: t('common.date'),
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
	worldRecord: t('levels.card.worldRecord'),
	authorTime: t('levels.card.authorTime'),
	by: t('levels.card.by'),
	created: t('levels.card.created'),
}))
const levelsPending = computed(() => !data.levelsActive.value || data.levelsQuery.fetching.value)
const wrPending = computed(
	() => !data.worldRecordsActive.value || data.wrResult.value.fetching.value,
)
const pbPending = computed(
	() => !data.personalBestsActive.value || data.pbResult.value.fetching.value,
)
</script>
