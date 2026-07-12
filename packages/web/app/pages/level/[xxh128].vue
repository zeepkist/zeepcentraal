Exit code: 0
Wall time: 0 seconds
Output:
<template>
	<UContainer class="space-y-8 py-2">
		<DataState
			:pending="levelData.detail.fetching.value"
			:error="levelData.detail.error.value?.message"
			:empty="!levelData.detail.fetching.value && !summary"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('levels.detail.notFound')"
		>
			<template v-if="summary">
				<section class="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
					<div>
						<UBadge v-if="summary.adventure" color="primary" variant="soft">{{ $t('common.adventure') }}</UBadge>
						<h1 class="mt-3 text-4xl font-black md:text-5xl">{{ summary.name }}</h1>
						<NuxtLink v-if="summary.authorSteamId" :to="`/user/${summary.authorSteamId}`" class="mt-2 inline-block text-muted-foreground hover:text-primary">
							{{ summary.authorName }}
						</NuxtLink>
						<p class="mt-4 break-all text-sm text-muted-foreground">{{ summary.xxHash }}</p>
					</div>
					<NuxtImg v-if="summary.imageUrl" :src="summary.imageUrl" :alt="summary.name" class="aspect-video w-full rounded-2xl object-cover" />
				</section>

				<section v-if="summary.medals" aria-labelledby="medals-heading">
					<SectionHeader id="medals-heading" :title="$t('levels.detail.medals.title')" :description="$t('levels.detail.medals.description')" />
					<MedalTimes :times="summary.medals" :labels="medalLabels" />
				</section>

				<section v-if="worldRecordRows.length" aria-labelledby="world-record-heading">
					<SectionHeader id="world-record-heading" :title="$t('levels.detail.worldRecord.title')" :description="$t('levels.detail.worldRecord.description')" />
					<RecordTable :records="worldRecordRows" v-bind="recordLabels" :show-rank="false" />
				</section>

				<section :ref="levelData.statisticsTarget" aria-labelledby="level-stats-heading">
					<SectionHeader id="level-stats-heading" :title="$t('levels.detail.stats.title')" :description="$t('levels.detail.stats.description')" />
					<DataState
						:pending="!levelData.statisticsActive.value || levelData.statistics.fetching.value"
						:error="levelData.statistics.error.value?.message"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<div class="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
							<MetricGrid :metrics="statMetrics" />
							<UCard class="rounded-xl border-border bg-card/85">
								<BarChart
									:data="statChart"
									:categories="statCategories"
									:y-axis="['value']"
									:height="280"
									:x-formatter="statLabel"
								/>
							</UCard>
						</div>
					</DataState>
				</section>

				<section :ref="levelData.recentTarget" aria-labelledby="recent-records-heading">
					<SectionHeader id="recent-records-heading" :title="$t('levels.detail.recent.title')" :description="$t('levels.detail.recent.description')" />
					<DataState
						:pending="!levelData.recentActive.value || levelData.recent.fetching.value"
						:error="levelData.recent.error.value?.message"
						:empty="levelData.recentRows.value.length === 0"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<RecordTable :records="levelData.recentRows.value" v-bind="recordLabels" :show-rank="false" />
					</DataState>
					<CursorPagination class="mt-4" :page="levelData.recentPage.value" :pending="levelData.recent.fetching.value" v-bind="paginationLabels" @first="levelData.recentPagination.first()" @previous="levelData.recentPagination.previous(levelData.recentPage.value)" @next="levelData.recentPagination.next(levelData.recentPage.value)" @last="levelData.recentPagination.last()" />
				</section>

				<section :ref="levelData.personalBestsTarget" aria-labelledby="personal-bests-heading">
					<SectionHeader id="personal-bests-heading" :title="$t('levels.detail.personalBests.title')" :description="$t('levels.detail.personalBests.description')" />
					<DataState
						:pending="!levelData.personalBestsActive.value || levelData.personalBests.fetching.value || levelData.viewerBest.fetching.value || levelData.viewerRank.fetching.value"
						:error="levelData.personalBests.error.value?.message || levelData.viewerBest.error.value?.message || levelData.viewerRank.error.value?.message"
						:empty="levelData.personalBestRows.value.length === 0"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<RecordTable :records="levelData.personalBestRows.value" v-bind="recordLabels" />
					</DataState>
					<CursorPagination class="mt-4" :page="levelData.personalBestPage.value" :pending="levelData.personalBests.fetching.value" v-bind="paginationLabels" @first="levelData.pbPagination.first()" @previous="levelData.pbPagination.previous(levelData.personalBestPage.value)" @next="levelData.pbPagination.next(levelData.personalBestPage.value)" @last="levelData.pbPagination.last()" />
				</section>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
import type { RecordRow } from '~/types/app'

const route = useRoute()
const { t } = useI18n()
const session = useSessionStore()
const user = computed(() => session.user)
const xxHash = computed(() => String(route.params.xxh128))
const viewerId = computed(() => user.value?.id)
const levelData = useLevelDetail(xxHash, viewerId)
const summary = levelData.summary
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

useSeoMeta({
	title: () =>
		summary.value ? `${summary.value.name} · ZeepCentraal` : t('pages.levels.seo.title'),
	description: () =>
		summary.value
			? t('levels.detail.seoDescription', { name: summary.value.name })
			: t('pages.levels.seo.description'),
})

const worldRecordRows = computed<RecordRow[]>(() => {
	const wr = levelData.level.value?.worldRecordGlobal
	if (!wr?.record) return []
	return [
		{
			id: wr.record.id,
			time: wr.record.time,
			dateCreated: String(wr.record.dateCreated),
			levelId: wr.record.levelId,
			userId: wr.record.userId,
			userSteamId: wr.user?.steamId == null ? null : String(wr.user.steamId),
			userName: wr.user?.steamName,
			viewer: viewerId.value === wr.record.userId,
			worldRecord: true,
		},
	]
})
const aggregates = computed(() => levelData.statistics.data.value?.recordStatistics?.aggregates)
const sums = computed(() => aggregates.value?.sum)
const statMetrics = computed(() => [
	{
		key: 'records',
		label: t('common.records'),
		value: String(summary.value?.recordCount ?? 0),
		icon: 'trophy',
	},
	{
		key: 'pbs',
		label: t('dashboard.metrics.personalBests'),
		value: String(levelData.level.value?.personalBestGlobals.totalCount ?? 0),
		icon: 'users',
	},
	{
		key: 'distance',
		label: t('dashboard.metrics.distance'),
		value: `${oneDecimal.format((sums.value?.distance ?? 0) / 1000)} km`,
		icon: 'route',
	},
	{
		key: 'airtime',
		label: t('dashboard.metrics.airtime'),
		value: `${oneDecimal.format((sums.value?.timeInAir ?? 0) / 3600)} h`,
		icon: 'dashboard',
	},
	{
		key: 'speed',
		label: t('levels.detail.stats.maxSpeed'),
		value: oneDecimal.format(aggregates.value?.max?.maxSpeed ?? 0),
		icon: 'dashboard',
	},
	{
		key: 'gforce',
		label: t('levels.detail.stats.maxGforce'),
		value: oneDecimal.format(aggregates.value?.max?.maxGforce ?? 0),
		icon: 'dashboard',
	},
])
const statChart = computed(() => [
	{ key: 'distance', value: (sums.value?.distance ?? 0) / 1000 },
	{ key: 'air', value: (sums.value?.distanceInAir ?? 0) / 1000 },
	{ key: 'ragdoll', value: (sums.value?.distanceRagdoll ?? 0) / 1000 },
	{ key: 'paraglider', value: (sums.value?.distanceParaglider ?? 0) / 1000 },
])
const statCategories = { value: { name: t('dashboard.totals.kilometres'), color: '#facc15' } }
const statLabel = (index: number) =>
	t(`levels.detail.stats.chart.${statChart.value[index]?.key ?? 'distance'}`)
const medalLabels = computed(() => ({
	author: t('levels.detail.medals.author'),
	gold: t('levels.detail.medals.gold'),
	silver: t('levels.detail.medals.silver'),
	bronze: t('levels.detail.medals.bronze'),
}))
const recordLabels = computed(() => ({
	rankLabel: t('common.rank'),
	userLabel: t('common.user'),
	levelLabel: t('common.level'),
	timeLabel: t('common.time'),
	dateLabel: t('common.date'),
}))
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
</script>
