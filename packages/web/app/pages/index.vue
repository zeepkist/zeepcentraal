<template>
	<UContainer class="space-y-8 py-2">
		<UAlert
			v-if="authVerificationFailed"
			data-testid="auth-verification-error"
			color="error"
			icon="i-lucide-circle-alert"
			:title="$t('auth.verificationFailed.title')"
			:description="$t('auth.verificationFailed.description')"
		/>

		<DashboardHero v-bind="hero" @login="login" />

		<section aria-labelledby="live-stats-heading">
			<SectionHeader id="live-stats-heading" :title="$t('dashboard.liveStats.title')" :description="$t('dashboard.liveStats.description')" />
			<MetricGrid :metrics="liveMetrics" />
		</section>

		<section aria-labelledby="popular-levels-heading">
			<SectionHeader id="popular-levels-heading" :title="$t('dashboard.popular.title')" :description="$t('dashboard.popular.description')" />
			<DataState
				:pending="dashboard.criticalQuery.fetching.value"
				:error="dashboard.criticalQuery.error.value?.message"
				:empty="dashboard.popularLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<LevelGrid :levels="dashboard.popularLevels.value" v-bind="levelLabels" />
			</DataState>
		</section>

		<section :ref="dashboard.latestLevelsTarget" aria-labelledby="latest-levels-heading">
			<SectionHeader id="latest-levels-heading" :title="$t('dashboard.latest.title')" :description="$t('dashboard.latest.description')" />
			<DataState
				:pending="!dashboard.latestLevelsActive.value || dashboard.latestLevelsQuery.fetching.value"
				:error="dashboard.latestLevelsQuery.error.value?.message"
				:empty="dashboard.latestLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<LevelGrid :levels="dashboard.latestLevels.value" v-bind="levelLabels" />
			</DataState>
		</section>

		<div v-if="user" :ref="dashboard.viewerTarget" class="space-y-8">
			<DataState
				:pending="!dashboard.viewerActive.value || dashboard.viewerContentQuery.fetching.value"
				:error="dashboard.viewerContentQuery.error.value?.message"
				:empty="dashboard.viewerRecords.value.length === 0 && dashboard.viewerLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<section v-if="dashboard.viewerRecords.value.length" aria-labelledby="viewer-records-heading">
					<SectionHeader id="viewer-records-heading" :title="$t('dashboard.viewerRecords.title')" :description="$t('dashboard.viewerRecords.description')" />
					<RecordTable :records="dashboard.viewerRecords.value" v-bind="recordLabels" show-level />
				</section>
				<section v-if="dashboard.viewerLevels.value.length" aria-labelledby="viewer-levels-heading">
					<SectionHeader id="viewer-levels-heading" :title="$t('dashboard.viewerLevels.title')" :description="$t('dashboard.viewerLevels.description')" />
					<LevelGrid :levels="dashboard.viewerLevels.value" v-bind="levelLabels" />
				</section>
			</DataState>
		</div>

		<div :ref="dashboard.recordsTarget">
			<DataState
				:pending="!dashboard.recordsActive.value || !dashboard.recordsReady.value"
				:error="dashboard.worldRecordsLive.error.value?.message || dashboard.personalBestsLive.error.value?.message"
				:empty="dashboard.worldRecordRecords.value.length === 0 && dashboard.personalBestRecords.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<div class="grid gap-6 xl:grid-cols-2">
					<DashboardRecordFeed
						:title="$t('dashboard.worldRecords.title')"
						:description="$t('dashboard.worldRecords.description')"
						:live-label="$t('common.live')"
						:records="dashboard.worldRecordRecords.value"
						v-bind="recordLabels"
					/>
					<DashboardRecordFeed
						:title="$t('dashboard.personalBests.title')"
						:description="$t('dashboard.personalBests.description')"
						:live-label="$t('common.live')"
						:records="dashboard.personalBestRecords.value"
						v-bind="recordLabels"
					/>
				</div>
			</DataState>
		</div>

		<section
			:ref="dashboard.statisticsTarget"
			aria-labelledby="distance-heading"
			data-prefetch="dashboard-statistics"
		>
			<SectionHeader id="distance-heading" :title="$t('dashboard.totals.title')" :description="$t('dashboard.totals.description')" />
			<DataState
				:pending="!dashboard.statisticsActive.value || dashboard.statisticsQuery.fetching.value"
				:error="dashboard.statisticsQuery.error.value?.message"
				:empty="!dashboard.statistics.value?.recordStatistics"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<div class="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
					<MetricGrid :metrics="totalMetrics" />
					<UCard class="rounded-xl border-border bg-card/85">
						<BarChart
							:data="distanceChart"
							:categories="distanceCategories"
							:y-axis="['value']"
							:height="300"
							:x-formatter="distanceLabel"
						/>
					</UCard>
				</div>
			</DataState>
		</section>

		<div :ref="dashboard.newsTarget">
			<DataState
				:pending="!dashboard.newsActive.value || dashboard.news.pending.value"
				:error="dashboard.news.error.value?.message"
				:empty="dashboard.news.data.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<SteamNewsFeed
					:title="$t('dashboard.news.title')"
					:description="$t('dashboard.news.description')"
					:items="dashboard.news.data.value"
				/>
			</DataState>
		</div>
	</UContainer>
</template>

<script setup lang="ts">
usePageSeo('home')

const { t, locale } = useI18n()
const route = useRoute()
const session = useSessionStore()
const { login } = useAccountActions()
const user = computed(() => session.user)
const authCallback = route.query.auth === 'callback'
const { verificationFailed: authVerificationFailed } = useAuthCallbackVerification(authCallback)
const viewerId = computed(() => user.value?.id)
const dashboard = useDashboard(viewerId)
await dashboard.prefetchCritical()
const numberFormat = new Intl.NumberFormat()
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const currentMonth = computed(() =>
	formatDashboardMonth(dashboard.metricMonthSince.value, locale.value),
)

const hero = computed(() => {
	const viewer = dashboard.viewer.value
	const latestSeason = dashboard.latestSeason.value
	const state = resolveDashboardHeroState(
		Boolean(user.value),
		dashboard.viewerQuery.data.value !== undefined,
		viewer?.records?.totalCount,
	)
	if (state === 'anonymous') {
		return {
			title: t('dashboard.hero.anonymous.title'),
			description: t('dashboard.hero.anonymous.description'),
			metrics: [],
			loginPrompt: {
				label: t('dashboard.hero.anonymous.loginPrompt.label'),
				steamLabel: t('dashboard.hero.anonymous.loginPrompt.steam'),
				discordLabel: t('dashboard.hero.anonymous.loginPrompt.discord'),
				orLabel: t('dashboard.hero.anonymous.loginPrompt.or'),
			},
			panel: {
				title: t('dashboard.hero.anonymous.panel.title'),
				description: t('dashboard.hero.anonymous.panel.description'),
				icon: 'brand-steam',
				features: [
					t('dashboard.hero.anonymous.panel.features.physics'),
					t('dashboard.hero.anonymous.panel.features.workshop'),
					t('dashboard.hero.anonymous.panel.features.community'),
				],
			},
			actions: [
				{
					label: t('dashboard.hero.steam'),
					description: t('dashboard.hero.steamDescription'),
					href: 'https://store.steampowered.com/app/1440670/Zeepkist/',
					icon: 'brand-steam',
					external: true,
					primary: true,
				},
				{
					label: t('dashboard.hero.setup'),
					description: t('dashboard.hero.setupDescription'),
					href: '/wiki/setup-modkist',
					icon: 'plug-connected',
				},
			],
		}
	}
	if (state === 'pending')
		return { title: '', description: '', actions: [], metrics: [], pending: true }
	const currentUser = user.value
	if (!currentUser) return { title: '', description: '', actions: [], metrics: [], pending: true }
	const leagueHref = latestSeason ? `/super-league/season-${latestSeason.id}` : '/super-league'
	const leagueAction = {
		label: t('dashboard.hero.superLeague'),
		description: latestSeason?.name ?? t('dashboard.hero.superLeagueDescription'),
		href: leagueHref,
		icon: 'flag-3',
	}
	if (state === 'new-player') {
		return {
			title: t('dashboard.hero.new.title', {
				name: currentUser.steamName ?? currentUser.steamId,
			}),
			description: t('dashboard.hero.new.description'),
			metrics: [],
			panel: {
				title: t('dashboard.hero.new.panel.title'),
				description: t('dashboard.hero.new.panel.description'),
				icon: 'shield-check',
				features: [
					t('dashboard.hero.new.panel.features.submit'),
					t('dashboard.hero.new.panel.features.ghosts'),
					t('dashboard.hero.new.panel.features.control'),
				],
			},
			actions: [
				{
					label: t('dashboard.hero.setup'),
					description: t('dashboard.hero.new.setupDescription'),
					href: '/wiki/setup-modkist',
					icon: 'plug-connected',
					primary: true,
				},
				leagueAction,
			],
		}
	}
	if (!viewer) return { title: '', description: '', actions: [], metrics: [], pending: true }
	const points = viewer.userPoints
	const standing = dashboard.viewerStanding.value
	return {
		title: t('dashboard.hero.active.title', {
			name: currentUser.steamName ?? currentUser.steamId,
		}),
		description: t('dashboard.hero.active.description'),
		metrics: [
			{
				label: t('dashboard.hero.metrics.records'),
				value: numberFormat.format(viewer.records.totalCount),
				icon: 'flag',
			},
			{
				label: t('dashboard.hero.metrics.personalBests'),
				value: numberFormat.format(viewer.personalBestGlobals.totalCount),
				icon: 'star',
			},
			{
				label: t('dashboard.hero.metrics.worldRecords'),
				value: numberFormat.format(viewer.worldRecordGlobals.totalCount),
				icon: 'trophy',
			},
			{
				label: t('dashboard.hero.metrics.globalRank'),
				value: points
					? `#${numberFormat.format(points.rank)}`
					: t('dashboard.hero.unranked'),
				icon: 'world',
				muted: !points,
			},
			{
				label: t('dashboard.hero.metrics.rankedPoints'),
				value: numberFormat.format(points?.points ?? 0),
				icon: 'sparkles',
			},
			{
				label: t('dashboard.hero.metrics.superLeague'),
				value: standing
					? t('dashboard.hero.seasonPosition', { position: standing.position })
					: t('dashboard.hero.unranked'),
				icon: 'flag-3',
				muted: !standing,
			},
		],
		panel: {
			title: t('dashboard.hero.active.panel.title'),
			description: t('dashboard.hero.active.panel.description', {
				points: numberFormat.format(points?.totalPoints ?? 0),
				seasonPoints: numberFormat.format(standing?.points ?? 0),
			}),
			icon: 'dashboard',
		},
		actions: [
			{
				label: t('dashboard.hero.profile'),
				description: t('dashboard.hero.profileDescription'),
				href: `/user/${currentUser.steamId}`,
				icon: 'users',
				primary: true,
			},
			{
				label: t('dashboard.hero.recentRecords'),
				description: t('dashboard.hero.recentRecordsDescription'),
				href: '/records/me',
				icon: 'clock-bolt',
			},
			leagueAction,
		],
	}
})

const liveMetrics = computed(() => {
	const data = dashboard.metrics.value
	const details = (day: number | undefined, month: number | undefined) => [
		{
			label: t('dashboard.metrics.past24Hours'),
			value: numberFormat.format(day ?? 0),
		},
		{
			label: currentMonth.value,
			value: numberFormat.format(month ?? 0),
		},
	]
	const rankedPlayers = numberFormat.format(data?.rankedUsers?.totalCount ?? 0)
	const activePlayersDay = numberFormat.format(data?.activeUsersDay?.totalCount ?? 0)

	return [
		{
			key: 'records',
			label: t('dashboard.metrics.records'),
			value: numberFormat.format(data?.records?.totalCount ?? 0),
			icon: 'clock-bolt',
			details: details(data?.recordsDay?.totalCount, data?.recordsMonth?.totalCount),
		},
		{
			key: 'pbs',
			label: t('dashboard.metrics.personalBests'),
			value: numberFormat.format(data?.personalBestGlobals?.totalCount ?? 0),
			icon: 'star',
			details: details(
				data?.personalBestGlobalsDay?.totalCount,
				data?.personalBestGlobalsMonth?.totalCount,
			),
		},
		{
			key: 'wrs',
			label: t('dashboard.metrics.worldRecords'),
			value: numberFormat.format(data?.worldRecordGlobals?.totalCount ?? 0),
			icon: 'trophy',
			details: details(
				data?.worldRecordGlobalsDay?.totalCount,
				data?.worldRecordGlobalsMonth?.totalCount,
			),
		},
		{
			key: 'levels',
			label: t('dashboard.metrics.levels'),
			value: numberFormat.format(data?.levels?.totalCount ?? 0),
			icon: 'map',
			details: details(data?.levelsDay?.totalCount, data?.levelsMonth?.totalCount),
		},
		{
			key: 'votes',
			label: t('dashboard.metrics.votes'),
			value: numberFormat.format(data?.votes?.totalCount ?? 0),
			icon: 'trending-up',
			details: details(data?.votesDay?.totalCount, data?.votesMonth?.totalCount),
		},
		{
			key: 'players',
			label: t('dashboard.metrics.rankedPlayers'),
			value: `${rankedPlayers} (${activePlayersDay})`,
			valueLabel: t('dashboard.metrics.rankedPlayersValueLabel', {
				rankedPlayers,
				activePlayers: activePlayersDay,
			}),
			icon: 'users',
			details: [
				{
					label: t('dashboard.metrics.totalPlayers'),
					value: numberFormat.format(data?.totalUsers?.totalCount ?? 0),
				},
				{
					label: t('dashboard.metrics.activeInMonth', { month: currentMonth.value }),
					value: numberFormat.format(data?.activeUsersMonth?.totalCount ?? 0),
				},
			],
		},
	]
})

const totals = computed(() => dashboard.statistics.value?.recordStatistics?.aggregates?.sum)
const totalMetrics = computed(() => [
	{
		key: 'distance',
		label: t('dashboard.metrics.distance'),
		value: `${oneDecimal.format((totals.value?.distance ?? 0) / 1000)} km`,
		icon: 'route',
	},
	{
		key: 'airtime',
		label: t('dashboard.metrics.airtime'),
		value: `${oneDecimal.format((totals.value?.timeInAir ?? 0) / 3600)} h`,
		icon: 'dashboard',
	},
	{
		key: 'ragdoll',
		label: t('dashboard.metrics.ragdoll'),
		value: `${oneDecimal.format((totals.value?.distanceRagdoll ?? 0) / 1000)} km`,
		icon: 'route',
	},
	{
		key: 'horns',
		label: t('dashboard.metrics.horns'),
		value: numberFormat.format(totals.value?.hornCount ?? 0),
		icon: 'dashboard',
	},
	{
		key: 'brakes',
		label: t('dashboard.metrics.brakes'),
		value: numberFormat.format(totals.value?.brakeCount ?? 0),
		icon: 'dashboard',
	},
])
const distanceChart = computed(() => [
	{ key: 'distance', value: (totals.value?.distance ?? 0) / 1000 },
	{ key: 'air', value: (totals.value?.distanceInAir ?? 0) / 1000 },
	{ key: 'ragdoll', value: (totals.value?.distanceRagdoll ?? 0) / 1000 },
])
const distanceCategories = { value: { name: t('dashboard.totals.kilometres'), color: '#facc15' } }
const distanceLabel = (index: number) =>
	t(`dashboard.totals.chart.${distanceChart.value[index]?.key ?? 'distance'}`)
const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
}))
const recordLabels = computed(() => ({
	rankLabel: t('common.rank'),
	userLabel: t('common.user'),
	levelLabel: t('common.level'),
	timeLabel: t('common.time'),
	dateLabel: t('common.date'),
}))
</script>
