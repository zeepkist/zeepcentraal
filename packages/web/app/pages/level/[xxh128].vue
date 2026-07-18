<template>
	<UContainer class="py-2">
		<DataState
			:pending="levelData.detail.fetching.value"
			:error="levelData.detail.error.value?.message"
			:empty="!levelData.detail.fetching.value && !summary"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('levels.detail.notFound')"
		>
			<template v-if="summary">
				<div class="space-y-8 lg:space-y-10">
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

					<section :ref="levelData.splitAnalysisTarget" aria-labelledby="split-analysis-heading">
						<SectionHeader
							id="split-analysis-heading"
							:title="$t('levels.detail.splitAnalysis.title')"
							:description="$t('levels.detail.splitAnalysis.description')"
						>
							<LevelSplitComparisonToggle
								v-if="hasViewerSplitComparison"
								v-model="showViewerSplitComparison"
								:show-label="splitAnalysisLabels.showMyComparison"
								:hide-label="splitAnalysisLabels.hideMyComparison"
							/>
						</SectionHeader>
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
								:show-viewer-comparison="showViewerSplitComparison"
							/>
						</DataState>
					</section>

					<AuthorLevelsCta
						:author-id="summary.authorId"
						:title="$t('levels.detail.authorCta.title', { author: summary.authorName })"
						:description="$t('levels.detail.authorCta.description')"
						:action="$t('levels.detail.authorCta.action')"
					/>

					<DetailSectionTabs
						v-model="activeDetailTab"
						:items="detailTabs"
						:label="$t('levels.detail.tabs.label')"
					>
						<template #records>
							<section
								:ref="levelData.personalBestsTarget"
								aria-labelledby="personal-bests-heading"
							>
								<SectionHeader
									id="personal-bests-heading"
									:title="$t('levels.detail.personalBests.title')"
									:description="$t('levels.detail.personalBests.description')"
								/>
								<DataState
									:pending="
										levelData.pbPagination.isInitialPending(
											levelData.personalBests.fetching.value ||
												levelData.personalBestRanks.fetching.value ||
												levelData.viewerBest.fetching.value ||
												levelData.viewerRank.fetching.value,
											levelData.personalBestRows.value.length,
											levelData.personalBestsActive.value,
										)
									"
									:error="levelData.personalBests.error.value?.message || levelData.personalBestRanks.error.value?.message || levelData.viewerBest.error.value?.message || levelData.viewerRank.error.value?.message"
									:empty="levelData.personalBestRows.value.length === 0"
									:loading-label="$t('common.loading')"
									:error-title="$t('common.error')"
									:empty-title="$t('common.empty')"
								>
									<RecordTable
										:records="levelData.personalBestRows.value"
										v-bind="recordLabels"
										show-points
									/>
								</DataState>
								<CursorPagination
									class="mt-4"
									:page="levelData.personalBestPage.value"
									:can-go-previous="
										levelData.pbPagination.canGoPrevious(levelData.personalBestPage.value)
									"
									:can-go-next="
										levelData.pbPagination.canGoNext(levelData.personalBestPage.value)
									"
									:pending="
										!levelData.personalBestsActive.value ||
										levelData.personalBests.fetching.value ||
										levelData.personalBestRanks.fetching.value
									"
									v-bind="paginationLabels"
									@first="levelData.pbPagination.first()"
									@previous="
										levelData.pbPagination.previous(levelData.personalBestPage.value)
									"
									@next="levelData.pbPagination.next(levelData.personalBestPage.value)"
									@last="levelData.pbPagination.last()"
								/>
							</section>

							<section :ref="levelData.recentTarget" aria-labelledby="recent-records-heading">
								<SectionHeader
									id="recent-records-heading"
									:title="$t('levels.detail.recent.title')"
									:description="$t('levels.detail.recent.description')"
								/>
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
									<RecordTable
										:records="levelData.recentRows.value"
										v-bind="recordLabels"
										:show-rank="false"
										show-pb-or-wr
									/>
								</DataState>
								<CursorPagination
									class="mt-4"
									:page="levelData.recentPage.value"
									:can-go-previous="
										levelData.recentPagination.canGoPrevious(levelData.recentPage.value)
									"
									:can-go-next="
										levelData.recentPagination.canGoNext(levelData.recentPage.value)
									"
									:pending="
										!levelData.recentActive.value || levelData.recent.fetching.value
									"
									v-bind="paginationLabels"
									@first="levelData.recentPagination.first()"
									@previous="
										levelData.recentPagination.previous(levelData.recentPage.value)
									"
									@next="levelData.recentPagination.next(levelData.recentPage.value)"
									@last="levelData.recentPagination.last()"
								/>
							</section>
						</template>

						<template #telemetry>
							<section :ref="levelData.statisticsTarget" aria-labelledby="level-stats-heading">
								<SectionHeader
									id="level-stats-heading"
									:title="$t('levels.detail.stats.title')"
									:description="$t('levels.detail.stats.description')"
								/>
								<DataState
									:pending="
										!levelData.statisticsActive.value || levelData.statistics.fetching.value
									"
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

							<section aria-labelledby="score-breakdown-heading">
								<SectionHeader
									id="score-breakdown-heading"
									:title="$t('levels.detail.scoreBreakdown.title')"
									:description="$t('levels.detail.scoreBreakdown.description')"
								/>
								<LevelScoreBreakdown
									:model="levelData.scoreInsights.value"
									:labels="scoreBreakdownLabels"
								/>
							</section>
						</template>
					</DetailSectionTabs>
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
const showViewerSplitComparison = ref(false)
type LevelDetailTab = 'records' | 'telemetry'
const activeDetailTab = ref<LevelDetailTab>('records')
const detailTabs = computed(() => [
	{ value: 'records' as const, label: t('levels.detail.tabs.records') },
	{ value: 'telemetry' as const, label: t('levels.detail.tabs.telemetry') },
])
const viewerSplitComparisonId = computed(
	() =>
		levelData.splitAnalysis.value.series.find((series) => series.viewerComparison)?.recordId,
)
const hasViewerSplitComparison = computed(() => viewerSplitComparisonId.value !== undefined)
watch(viewerSplitComparisonId, () => {
	showViewerSplitComparison.value = false
})

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
	competitivenessRatings: {
		veryEasy: t('levels.detail.hero.competitivenessRatings.veryEasy'),
		easy: t('levels.detail.hero.competitivenessRatings.easy'),
		balanced: t('levels.detail.hero.competitivenessRatings.balanced'),
		competitive: t('levels.detail.hero.competitivenessRatings.competitive'),
		hard: t('levels.detail.hero.competitivenessRatings.hard'),
		expert: t('levels.detail.hero.competitivenessRatings.expert'),
		intense: t('levels.detail.hero.competitivenessRatings.intense'),
	},
	unavailable: t('levels.detail.hero.unavailable'),
	worldRecord: t('levels.detail.worldRecord.title'),
	worldRecordSet: t('levels.detail.worldRecord.set'),
	noWorldRecordTitle: t('levels.detail.worldRecord.emptyTitle'),
	noWorldRecordDescription: t('levels.detail.worldRecord.emptyDescription'),
	workshopAction: t('levels.detail.hero.workshopAction'),
}))
const splitAnalysisLabels = computed(() => ({
	checkpoint: t('levels.detail.splitAnalysis.checkpoint'),
	finish: t('common.finish'),
	deltaTitle: t('levels.detail.splitAnalysis.deltaTitle'),
	deltaDescription: t('levels.detail.splitAnalysis.deltaDescription'),
	speedTitle: t('levels.detail.splitAnalysis.speedTitle'),
	speedDescription: t('levels.detail.splitAnalysis.speedDescription'),
	secondsUnit: t('dashboard.totals.units.seconds'),
	speedUnit: t('dashboard.totals.units.kilometresPerHour'),
	showMyComparison: t('levels.detail.splitAnalysis.showMyComparison'),
	hideMyComparison: t('levels.detail.splitAnalysis.hideMyComparison'),
}))
const medalLabels = computed(() => ({
	author: t('levels.detail.medals.author'),
	gold: t('levels.detail.medals.gold'),
	silver: t('levels.detail.medals.silver'),
	bronze: t('levels.detail.medals.bronze'),
}))
const scoreBreakdownLabels = computed(() => ({
	groups: {
		score: {
			title: t('levels.detail.scoreBreakdown.groups.score.title'),
			description: t('levels.detail.scoreBreakdown.groups.score.description'),
		},
		evidence: {
			title: t('levels.detail.scoreBreakdown.groups.evidence.title'),
			description: t('levels.detail.scoreBreakdown.groups.evidence.description'),
		},
		leaderboard: {
			title: t('levels.detail.scoreBreakdown.groups.leaderboard.title'),
			description: t('levels.detail.scoreBreakdown.groups.leaderboard.description'),
		},
		driving: {
			title: t('levels.detail.scoreBreakdown.groups.driving.title'),
			description: t('levels.detail.scoreBreakdown.groups.driving.description'),
		},
	},
	metrics: {
		sampleSize: t('levels.detail.scoreBreakdown.metrics.sampleSize'),
		leaderboardConfidence: t('levels.detail.scoreBreakdown.metrics.leaderboardConfidence'),
		inputSampleSize: t('levels.detail.scoreBreakdown.metrics.inputSampleSize'),
		inputCoverage: t('levels.detail.scoreBreakdown.metrics.inputCoverage'),
		airSampleSize: t('levels.detail.scoreBreakdown.metrics.airSampleSize'),
		wheelSampleSize: t('levels.detail.scoreBreakdown.metrics.wheelSampleSize'),
		slipSampleSize: t('levels.detail.scoreBreakdown.metrics.slipSampleSize'),
		ragdollSampleSize: t('levels.detail.scoreBreakdown.metrics.ragdollSampleSize'),
		stateSampleSize: t('levels.detail.scoreBreakdown.metrics.stateSampleSize'),
		surfaceSampleSize: t('levels.detail.scoreBreakdown.metrics.surfaceSampleSize'),
		velocitySampleSize: t('levels.detail.scoreBreakdown.metrics.velocitySampleSize'),
		competitivenessScore: t('levels.detail.scoreBreakdown.metrics.competitivenessScore'),
		worldRecordDifficultyScore: t(
			'levels.detail.scoreBreakdown.metrics.worldRecordDifficultyScore',
		),
		participationScore: t('levels.detail.scoreBreakdown.metrics.participationScore'),
		voteAdjustment: t('levels.detail.scoreBreakdown.metrics.voteAdjustment'),
		passivePlaySeverity: t('levels.detail.scoreBreakdown.metrics.passivePlaySeverity'),
		afkModifier: t('levels.detail.scoreBreakdown.metrics.afkModifier'),
		passiveRunRatio: t('levels.detail.scoreBreakdown.metrics.passiveRunRatio'),
		passiveTop10Share: t('levels.detail.scoreBreakdown.metrics.passiveTop10Share'),
		bestPassiveRank: t('levels.detail.scoreBreakdown.metrics.bestPassiveRank'),
		bestPassiveGap: t('levels.detail.scoreBreakdown.metrics.bestPassiveGap'),
		driverEngagementScore: t('levels.detail.scoreBreakdown.metrics.driverEngagementScore'),
		worldRecordMargin: t('levels.detail.scoreBreakdown.metrics.worldRecordMargin'),
		top5Spread: t('levels.detail.scoreBreakdown.metrics.top5Spread'),
		top10Spread: t('levels.detail.scoreBreakdown.metrics.top10Spread'),
		top50Spread: t('levels.detail.scoreBreakdown.metrics.top50Spread'),
		wrChallengerCount: t('levels.detail.scoreBreakdown.metrics.wrChallengerCount'),
		worldRecordOptimizationScore: t(
			'levels.detail.scoreBreakdown.metrics.worldRecordOptimizationScore',
		),
		leaderboardAnomalyScore: t(
			'levels.detail.scoreBreakdown.metrics.leaderboardAnomalyScore',
		),
		telemetryAnomalyScore: t('levels.detail.scoreBreakdown.metrics.telemetryAnomalyScore'),
		worldRecordExcluded: t('levels.detail.scoreBreakdown.metrics.worldRecordExcluded'),
		pathConsistencyScore: t('levels.detail.scoreBreakdown.metrics.pathConsistencyScore'),
		speedConsistencyScore: t('levels.detail.scoreBreakdown.metrics.speedConsistencyScore'),
		routeConsistencyScore: t('levels.detail.scoreBreakdown.metrics.routeConsistencyScore'),
		surfaceDiversityScore: t('levels.detail.scoreBreakdown.metrics.surfaceDiversityScore'),
		matureVoteCount: t('levels.detail.scoreBreakdown.metrics.matureVoteCount'),
		typicalDistance: t('levels.detail.scoreBreakdown.metrics.typicalDistance'),
		typicalAverageSpeed: t('levels.detail.scoreBreakdown.metrics.typicalAverageSpeed'),
		typicalMaxSpeed: t('levels.detail.scoreBreakdown.metrics.typicalMaxSpeed'),
		typicalAirTimeShare: t('levels.detail.scoreBreakdown.metrics.typicalAirTimeShare'),
		typicalGroundTimeShare: t('levels.detail.scoreBreakdown.metrics.typicalGroundTimeShare'),
		typicalSlipShare: t('levels.detail.scoreBreakdown.metrics.typicalSlipShare'),
		typicalRagdollShare: t('levels.detail.scoreBreakdown.metrics.typicalRagdollShare'),
		typicalAverageAngularVelocity: t(
			'levels.detail.scoreBreakdown.metrics.typicalAverageAngularVelocity',
		),
		typicalAverageGforce: t('levels.detail.scoreBreakdown.metrics.typicalAverageGforce'),
		medianSteeringShare: t('levels.detail.scoreBreakdown.metrics.medianSteeringShare'),
		q25SteeringShare: t('levels.detail.scoreBreakdown.metrics.q25SteeringShare'),
		lowSteeringRatio: t('levels.detail.scoreBreakdown.metrics.lowSteeringRatio'),
		zeroControlRatio: t('levels.detail.scoreBreakdown.metrics.zeroControlRatio'),
		medianBrakeShare: t('levels.detail.scoreBreakdown.metrics.medianBrakeShare'),
		medianArmsUpShare: t('levels.detail.scoreBreakdown.metrics.medianArmsUpShare'),
		medianControlTransitionRate: t(
			'levels.detail.scoreBreakdown.metrics.medianControlTransitionRate',
		),
	},
	unavailable: t('levels.detail.scoreBreakdown.unavailable'),
	notAvailable: t('levels.detail.scoreBreakdown.notAvailable'),
	included: t('levels.detail.scoreBreakdown.included'),
	excluded: t('levels.detail.scoreBreakdown.excluded'),
	units: {
		metres: t('dashboard.totals.units.metres'),
		kilometres: t('dashboard.totals.units.kilometres'),
		kilometresPerHour: t('dashboard.totals.units.kilometresPerHour'),
		gforce: t('dashboard.totals.units.g'),
		radiansPerSecond: t('levels.detail.scoreBreakdown.units.radiansPerSecond'),
		perSecond: t('levels.detail.scoreBreakdown.units.perSecond'),
	},
}))
const recordLabels = computed(() => ({
	rankLabel: t('common.rank'),
	userLabel: t('common.user'),
	levelLabel: t('common.level'),
	timeLabel: t('common.time'),
	dateLabel: t('common.date'),
	pointsLabel: t('common.points'),
	pbOrWrLabel: t('levels.detail.recordTable.pbOrWr'),
	personalBestLabel: t('levels.detail.recordTable.personalBest'),
	worldRecordLabel: t('levels.card.worldRecord'),
	openRecordLabel: t('pages.records.table.openRecord', {
		level: summary.value?.name ?? t('common.level'),
	}),
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
