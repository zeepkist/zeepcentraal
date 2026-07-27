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
			<MetricGrid :metrics="liveMetrics" :columns="3" />
		</section>

		<section aria-labelledby="trending-levels-heading">
			<SectionHeader id="trending-levels-heading" :title="$t('dashboard.trendingLevels.title')" :description="$t('dashboard.trendingLevels.description')" />
			<DataState
				:pending="dashboard.criticalQuery.fetching.value"
				:error="dashboard.criticalQuery.error.value?.message"
				:empty="dashboard.trendingLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<template #pending><LevelGridSkeleton :columns="3" /></template>
				<LevelGrid :levels="dashboard.trendingLevels.value" v-bind="dashboardLevelLabels" />
			</DataState>
		</section>

		<section :ref="dashboard.newsTarget" aria-labelledby="steam-news-heading">
			<SectionHeader
				id="steam-news-heading"
				:title="$t('dashboard.news.title')"
				:description="$t('dashboard.news.description')"
			/>
			<DataState
				:pending="!dashboard.newsActive.value || dashboard.news.pending.value"
				:error="dashboard.news.error.value?.message"
				:empty="dashboard.news.data.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<template #pending>
					<div class="grid gap-4 md:grid-cols-2">
						<div
							v-for="index in 2"
							:key="index"
							class="min-h-48 space-y-4 rounded-xl border border-border bg-card/60 p-5"
						>
							<USkeleton class="h-4 w-1/4" />
							<USkeleton class="h-7 w-3/4" />
							<USkeleton class="h-16 w-full" />
							<USkeleton class="h-4 w-1/3" />
						</div>
					</div>
				</template>
				<SteamNewsFeed :items="dashboard.news.data.value" />
			</DataState>
		</section>

		<section :ref="dashboard.popularLevelsTarget" aria-labelledby="popular-levels-heading">
			<SectionHeader id="popular-levels-heading" :title="$t('dashboard.popular.title')" :description="$t('dashboard.popular.description')" />
			<DataState
				:pending="!dashboard.popularLevelsActive.value || dashboard.popularLevelsQuery.fetching.value"
				:error="dashboard.popularLevelsQuery.error.value?.message"
				:empty="dashboard.popularLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<template #pending><LevelGridSkeleton :columns="3" /></template>
				<LevelGrid :levels="dashboard.popularLevels.value" v-bind="dashboardLevelLabels" />
			</DataState>
		</section>

		<section
			:ref="dashboard.statisticsTarget"
			aria-labelledby="distance-heading"
			data-prefetch="dashboard-statistics"
		>
			<SectionHeader id="distance-heading" :title="$t('dashboard.totals.title')" :description="$t('dashboard.totals.description')" />
			<DataState
				:pending="!dashboard.statisticsActive.value || dashboard.statisticsQuery.fetching.value"
				:error="dashboard.statisticsQuery.error.value?.message"
				:empty="!dashboard.statistics.value?.allTimeStatistics"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<template #pending><DashboardStatisticsSkeleton /></template>
				<DashboardStatisticsPanel :model="statisticsModel" />
			</DataState>
		</section>

		<section :ref="dashboard.hotLevelsTarget" aria-labelledby="hot-levels-heading">
			<SectionHeader id="hot-levels-heading" :title="$t('dashboard.hotLevels.title')" :description="$t('dashboard.hotLevels.description')" />
			<DataState
				:pending="!dashboard.hotLevelsActive.value || dashboard.hotLevelsQuery.fetching.value"
				:error="dashboard.hotLevelsQuery.error.value?.message"
				:empty="dashboard.hotLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
			>
				<template #pending><LevelGridSkeleton :columns="3" /></template>
				<LevelGrid :levels="dashboard.hotLevels.value" v-bind="dashboardLevelLabels" />
			</DataState>
		</section>

		<section v-if="user" :ref="dashboard.viewerTarget">
			<DataState
				:pending="!dashboard.viewerActive.value || dashboard.viewerLevelsQuery.fetching.value"
				:error="dashboard.viewerLevelsQuery.error.value?.message"
				:empty="dashboard.viewerLevels.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('common.empty')"
				class="space-y-8"
			>
				<template #pending><LevelGridSkeleton :columns="3" /></template>
				<section v-if="dashboard.viewerLevels.value.length" aria-labelledby="viewer-levels-heading">
					<SectionHeader id="viewer-levels-heading" :title="$t('dashboard.viewerLevels.title')" :description="$t('dashboard.viewerLevels.description')" />
					<LevelGrid :levels="dashboard.viewerLevels.value" v-bind="dashboardLevelLabels" />
				</section>
			</DataState>
		</section>
	</UContainer>
</template>

<script setup vapor lang="ts">
import type {
	HeroAction,
	HeroMetric,
	HeroPanel,
	StatisticMetric,
} from '~/types/app'

type DashboardHeroModel = {
	title: string
	description: string
	actions: HeroAction[]
	metrics?: HeroMetric[]
	panel?: HeroPanel
	pending?: boolean
	loginPrompt?: {
		label: string
		steamLabel: string
		discordLabel: string
		orLabel: string
	}
}

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

const hero = computed<DashboardHeroModel>(() => {
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
	const leagueAction: HeroAction = {
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

const liveMetrics = computed<StatisticMetric[]>(() => {
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
	const totalPlayers = numberFormat.format(data?.totalUsers?.totalCount ?? 0)
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
			label: t('dashboard.metrics.rankedAndTotalPlayers'),
			value: `${rankedPlayers} / ${totalPlayers}`,
			valueLabel: t('dashboard.metrics.rankedAndTotalPlayersValueLabel', {
				rankedPlayers,
				totalPlayers,
			}),
			icon: 'users',
			details: [
				{
					label: t('dashboard.metrics.activeToday'),
					value: activePlayersDay,
				},
				{
					label: t('dashboard.metrics.activeInMonth', { month: currentMonth.value }),
					value: numberFormat.format(data?.activeUsersMonth?.totalCount ?? 0),
				},
			],
		},
	]
})

const statisticsModel = useDashboardStatisticsModel(dashboard.statistics, currentMonth)

const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
}))
const dashboardLevelLabels = computed(() => ({
	...levelLabels.value,
	personalBestsLabel: t('levels.card.personalBests'),
	ratingLabel: t('levels.card.rating'),
	unavailableLabel: t('levels.card.unavailable'),
	worldRecordLabel: t('levels.card.worldRecord'),
	authorTimeLabel: t('levels.card.authorTime'),
	byLabel: t('levels.card.by'),
}))
</script>
