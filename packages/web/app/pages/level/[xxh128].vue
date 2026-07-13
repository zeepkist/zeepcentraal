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
				<LevelDetailHero
					:level="summary"
					:world-record="levelData.worldRecord.value"
					:workshop-url="workshopUrl"
					:labels="heroLabels"
				/>

				<section v-if="summary.medals" aria-labelledby="medals-heading">
					<SectionHeader id="medals-heading" :title="$t('levels.detail.medals.title')" :description="$t('levels.detail.medals.description')" />
					<MedalTimes :times="summary.medals" :labels="medalLabels" />
				</section>

				<section :ref="levelData.pointsHistoryTarget" aria-labelledby="level-points-heading">
					<SectionHeader
						id="level-points-heading"
						:title="$t('levels.detail.pointsHistory.title')"
						:description="$t('levels.detail.pointsHistory.description')"
					/>
					<DataState
						:pending="
							!levelData.pointsHistoryActive.value ||
							levelData.pointsHistoryQuery.fetching.value
						"
						:error="levelData.pointsHistoryQuery.error.value?.message"
						:empty="
							levelData.pointsHistoryActive.value &&
							!levelData.pointsHistoryQuery.fetching.value &&
							levelData.pointsHistory.value.length === 0
						"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<LevelPointsInsights
							:history="levelData.pointsHistory.value"
							:series-label="$t('levels.detail.pointsHistory.series')"
						/>
					</DataState>
				</section>

				<AuthorLevelsCta
					:author-id="summary.authorId"
					:title="$t('levels.detail.authorCta.title', { author: summary.authorName })"
					:description="$t('levels.detail.authorCta.description')"
					:action="$t('levels.detail.authorCta.action')"
				/>

				<section :ref="levelData.statisticsTarget" aria-labelledby="level-stats-heading">
					<SectionHeader id="level-stats-heading" :title="$t('levels.detail.stats.title')" :description="$t('levels.detail.stats.description')" />
					<DataState
						:pending="!levelData.statisticsActive.value || levelData.statistics.fetching.value"
						:error="levelData.statistics.error.value?.message"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<LevelTelemetryPanel
							:model="telemetryModel"
							:description="$t('levels.detail.stats.telemetryDescription')"
						/>
					</DataState>
				</section>
				<section :ref="levelData.splitAnalysisTarget" aria-labelledby="split-analysis-heading">
					<SectionHeader
						id="split-analysis-heading"
						:title="$t('levels.detail.splitAnalysis.title')"
						:description="$t('levels.detail.splitAnalysis.description')"
					/>
					<DataState
						:pending="
							!levelData.splitAnalysisActive.value ||
							levelData.splitAnalysisQuery.fetching.value
						"
						:error="levelData.splitAnalysisQuery.error.value?.message"
						:empty="
							levelData.splitAnalysisActive.value &&
							!levelData.splitAnalysisQuery.fetching.value &&
							levelData.splitAnalysis.value.series.length === 0
						"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('levels.detail.splitAnalysis.empty')"
					>
						<LevelSplitAnalysis
							:analysis="levelData.splitAnalysis.value"
							:labels="splitAnalysisLabels"
						/>
					</DataState>
				</section>

				<div class="grid gap-8 xl:grid-cols-2 xl:items-start">
					<section :ref="levelData.recentTarget" aria-labelledby="recent-records-heading">
					<SectionHeader id="recent-records-heading" :title="$t('levels.detail.recent.title')" :description="$t('levels.detail.recent.description')" />
					<DataState
						:pending="
							levelData.recentPagination.isInitialPending(
								levelData.recent.fetching.value,
								levelData.recentRows.value.length,
								levelData.recentActive.value,
							)
						"
						:error="levelData.recent.error.value?.message"
						:empty="levelData.recentRows.value.length === 0"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<RecordTable :records="levelData.recentRows.value" v-bind="recordLabels" :show-rank="false" />
					</DataState>
					<CursorPagination class="mt-4" :page="levelData.recentPage.value" :can-go-previous="levelData.recentPagination.canGoPrevious(levelData.recentPage.value)" :can-go-next="levelData.recentPagination.canGoNext(levelData.recentPage.value)" :pending="levelData.recent.fetching.value" v-bind="paginationLabels" @first="levelData.recentPagination.first()" @previous="levelData.recentPagination.previous(levelData.recentPage.value)" @next="levelData.recentPagination.next(levelData.recentPage.value)" @last="levelData.recentPagination.last()" />
				</section>

				<section :ref="levelData.personalBestsTarget" aria-labelledby="personal-bests-heading">
					<SectionHeader id="personal-bests-heading" :title="$t('levels.detail.personalBests.title')" :description="$t('levels.detail.personalBests.description')" />
					<DataState
						:pending="
							levelData.pbPagination.isInitialPending(
								levelData.personalBests.fetching.value ||
									levelData.viewerBest.fetching.value ||
									levelData.viewerRank.fetching.value,
								levelData.personalBestRows.value.length,
								levelData.personalBestsActive.value,
							)
						"
						:error="levelData.personalBests.error.value?.message || levelData.viewerBest.error.value?.message || levelData.viewerRank.error.value?.message"
						:empty="levelData.personalBestRows.value.length === 0"
						:loading-label="$t('common.loading')"
						:error-title="$t('common.error')"
						:empty-title="$t('common.empty')"
					>
						<RecordTable :records="levelData.personalBestRows.value" v-bind="recordLabels" />
					</DataState>
					<CursorPagination class="mt-4" :page="levelData.personalBestPage.value" :can-go-previous="levelData.pbPagination.canGoPrevious(levelData.personalBestPage.value)" :can-go-next="levelData.pbPagination.canGoNext(levelData.personalBestPage.value)" :pending="levelData.personalBests.fetching.value" v-bind="paginationLabels" @first="levelData.pbPagination.first()" @previous="levelData.pbPagination.previous(levelData.personalBestPage.value)" @next="levelData.pbPagination.next(levelData.personalBestPage.value)" @last="levelData.pbPagination.last()" />
				</section>
				</div>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const session = useSessionStore()
const user = computed(() => session.user)
const xxHash = computed(() => String(route.params.xxh128))
const viewerId = computed(() => user.value?.id)
const levelData = useLevelDetail(xxHash, viewerId)
await levelData.prefetchCritical()
const summary = levelData.summary
const workshopUrl = computed(() => steamWorkshopItemUrl(summary.value?.workshopId))
const telemetryModel = useLevelTelemetryModel(levelData.statistics.data)

useSeoMeta({
	title: () =>
		summary.value ? `${summary.value.name} · ZeepCentraal` : t('pages.levels.seo.title'),
	description: () =>
		summary.value
			? t('levels.detail.seoDescription', { name: summary.value.name })
			: t('pages.levels.seo.description'),
})

const heroLabels = computed(() => ({
	adventure: t('common.adventure'),
	published: t('levels.detail.hero.published'),
	unknownAuthor: t('levels.detail.hero.unknownAuthor'),
	points: t('levels.detail.hero.points'),
	rating: t('levels.detail.hero.rating'),
	records: t('common.records'),
	personalBests: t('dashboard.metrics.personalBests'),
	trackLength: t('levels.detail.hero.trackLength'),
	competitiveness: t('levels.detail.hero.competitiveness'),
	unavailable: t('levels.detail.hero.unavailable'),
	worldRecord: t('levels.detail.worldRecord.title'),
	noWorldRecordTitle: t('levels.detail.worldRecord.emptyTitle'),
	noWorldRecordDescription: t('levels.detail.worldRecord.emptyDescription'),
	workshopAction: t('levels.detail.hero.workshopAction'),
}))
const splitAnalysisLabels = computed(() => ({
	checkpoint: t('levels.detail.splitAnalysis.checkpoint'),
	deltaTitle: t('levels.detail.splitAnalysis.deltaTitle'),
	deltaDescription: t('levels.detail.splitAnalysis.deltaDescription'),
	speedTitle: t('levels.detail.splitAnalysis.speedTitle'),
	speedDescription: t('levels.detail.splitAnalysis.speedDescription'),
	secondsUnit: t('dashboard.totals.units.seconds'),
	speedUnit: t('dashboard.totals.units.kilometresPerHour'),
}))
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
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
</script>
