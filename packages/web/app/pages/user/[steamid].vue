<template>
	<UContainer class="space-y-8 py-2">
		<DataState
			:pending="data.profile.fetching.value"
			:error="data.profile.error.value?.message"
			:empty="!data.profile.fetching.value && !user"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('users.profile.notFound')"
		>
			<template v-if="user">
				<section class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-10">
					<div class="absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
					<p class="text-sm font-semibold uppercase tracking-widest text-primary">{{ $t('users.profile.eyebrow') }}</p>
					<h1 class="mt-2 text-4xl font-black md:text-5xl">{{ user.steamName ?? steamId }}</h1>
					<p class="mt-3 text-sm text-muted-foreground">{{ steamId }}</p>
				</section>

				<section aria-labelledby="profile-summary">
					<SectionHeader id="profile-summary" :title="$t('users.profile.summary.title')" :description="$t('users.profile.summary.description')" />
					<MetricGrid :metrics="metrics" />
				</section>

				<section :ref="data.statisticsTarget" aria-labelledby="profile-telemetry">
					<SectionHeader id="profile-telemetry" :title="$t('users.profile.telemetry.title')" :description="$t('users.profile.telemetry.description')" />
					<DataState :pending="!data.statisticsActive.value || data.statistics.fetching.value" :error="data.statistics.error.value?.message" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('common.empty')">
						<div class="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
							<MetricGrid :metrics="telemetryMetrics" />
							<UCard class="rounded-xl border-border bg-card/85">
								<BarChart
									:data="chartData"
									:categories="chartCategories"
									:y-axis="['value']"
									:height="280"
									:x-formatter="chartLabel"
								/>
							</UCard>
						</div>
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
						:labels="resultLabels"
						:sort-options="resultSortOptions"
						:pagination-labels="paginationLabels"
						@update:sort="data.setWrSort"
						@previous="data.wrPagination.previous(data.wrPage.value)"
						@next="data.wrPagination.next(data.wrPage.value)"
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
						:labels="resultLabels"
						:sort-options="resultSortOptions"
						:pagination-labels="paginationLabels"
						@update:sort="data.setPbSort"
						@previous="data.pbPagination.previous(data.pbPage.value)"
						@next="data.pbPagination.next(data.pbPage.value)"
					/>
				</div>

				<section :ref="data.recentTarget" aria-labelledby="profile-recent">
					<SectionHeader id="profile-recent" :title="$t('users.profile.recent.title')" :description="$t('users.profile.recent.description')" />
					<DataState :pending="!data.recentActive.value || data.recent.fetching.value" :error="data.recent.error.value?.message" :empty="data.recentRows.value.length === 0" v-bind="stateLabels">
						<UserResultTable :records="data.recentRows.value" :labels="resultLabels" />
					</DataState>
					<CursorPagination class="mt-4" :page="data.recentPage.value" :pending="data.recent.fetching.value" v-bind="paginationLabels" @previous="data.recentPagination.previous(data.recentPage.value)" @next="data.recentPagination.next(data.recentPage.value)" />
				</section>
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
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const sums = computed(() => data.statistics.data.value?.recordStatistics?.aggregates?.sum)
const aggregates = computed(() => data.statistics.data.value?.recordStatistics?.aggregates)

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
		value: user.value?.userPoints ? `#${number.format(user.value.userPoints.rank)}` : '—',
		icon: 'trophy',
	},
	{
		key: 'points',
		label: t('users.columns.rankedPoints'),
		value: number.format(user.value?.userPoints?.points ?? 0),
		icon: 'dashboard',
	},
	{
		key: 'total',
		label: t('users.columns.totalPoints'),
		value: number.format(user.value?.userPoints?.totalPoints ?? 0),
		icon: 'dashboard',
	},
	{
		key: 'records',
		label: t('common.records'),
		value: number.format(user.value?.records.totalCount ?? 0),
		icon: 'route',
	},
	{
		key: 'pbs',
		label: t('dashboard.metrics.personalBests'),
		value: number.format(user.value?.personalBestGlobals.totalCount ?? 0),
		icon: 'users',
	},
	{
		key: 'wrs',
		label: t('users.columns.worldRecords'),
		value: number.format(user.value?.worldRecordGlobals.totalCount ?? 0),
		icon: 'flag',
	},
	{
		key: 'levels',
		label: t('common.levels'),
		value: number.format(user.value?.levelItems.totalCount ?? 0),
		icon: 'map',
	},
])
const telemetryMetrics = computed(() => [
	{
		key: 'distance',
		label: t('dashboard.metrics.distance'),
		value: `${number.format((sums.value?.distance ?? 0) / 1000)} km`,
		icon: 'route',
	},
	{
		key: 'airtime',
		label: t('dashboard.metrics.airtime'),
		value: `${number.format((sums.value?.timeInAir ?? 0) / 3600)} h`,
		icon: 'dashboard',
	},
	{
		key: 'speed',
		label: t('users.profile.telemetry.maxSpeed'),
		value: number.format(aggregates.value?.max?.maxSpeed ?? 0),
		icon: 'dashboard',
	},
	{
		key: 'gforce',
		label: t('users.profile.telemetry.maxGforce'),
		value: number.format(aggregates.value?.max?.maxGforce ?? 0),
		icon: 'dashboard',
	},
])
const chartData = computed(() => [
	{ key: 'distance', value: (sums.value?.distance ?? 0) / 1000 },
	{ key: 'air', value: (sums.value?.distanceInAir ?? 0) / 1000 },
	{ key: 'ragdoll', value: (sums.value?.distanceRagdoll ?? 0) / 1000 },
	{ key: 'paraglider', value: (sums.value?.distanceParaglider ?? 0) / 1000 },
])
const chartCategories = { value: { name: t('dashboard.totals.kilometres'), color: '#facc15' } }
const chartLabel = (index: number) =>
	t(`users.profile.telemetry.chart.${chartData.value[index]?.key ?? 'distance'}`)
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
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
}))
const stateLabels = computed(() => ({
	loadingLabel: t('common.loading'),
	errorTitle: t('common.error'),
	emptyTitle: t('common.empty'),
}))
const wrPending = computed(
	() => !data.worldRecordsActive.value || data.wrResult.value.fetching.value,
)
const pbPending = computed(
	() => !data.personalBestsActive.value || data.pbResult.value.fetching.value,
)
</script>
