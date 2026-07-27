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
							<template #pending>
								<div class="grid min-h-80 gap-4 rounded-2xl border border-border bg-card/40 p-4">
									<USkeleton class="h-8 w-48" />
									<USkeleton class="min-h-64 w-full" />
								</div>
							</template>
							<LazyLevelPointsInsights
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
							<template #pending>
								<div class="grid min-h-96 gap-4 rounded-2xl border border-border bg-card/40 p-4">
									<USkeleton class="h-10 w-64" />
									<USkeleton class="min-h-72 w-full" />
								</div>
							</template>
							<LazyLevelSplitAnalysis
								:analysis="levelData.splitAnalysis.value"
								:labels="splitAnalysisLabels"
								:show-viewer-comparison="showViewerSplitComparison"
							/>
						</DataState>
					</section>

					<AuthorLevelsCta
						v-if="summary.publiclyVisible"
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
												levelData.viewerBest.fetching.value,
											levelData.personalBestRows.value.length,
											levelData.personalBestsActive.value,
										)
									"
									:error="levelData.personalBests.error.value?.message || levelData.personalBestRanks.error.value?.message || levelData.viewerBest.error.value?.message"
									:empty="levelData.personalBestRows.value.length === 0"
									:loading-label="$t('common.loading')"
									:error-title="$t('common.error')"
									:empty-title="$t('common.empty')"
								>
									<template #pending>
										<USkeleton class="min-h-96 w-full rounded-2xl" />
									</template>
									<LazyRecordHistoryTable
										:records="levelData.personalBestRows.value"
										:labels="recordLabels"
										:viewer-user-id="viewerId"
										:show-level="false"
										live-update-label=""
										rank-first
										show-player
										show-delta
										:fastest-time="levelData.worldRecord.value?.time"
										status-mode="none"
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
									<template #pending>
										<USkeleton class="min-h-96 w-full rounded-2xl" />
									</template>
									<LazyRecordHistoryTable
										:records="levelData.recentRows.value"
										:labels="recordLabels"
										:viewer-user-id="viewerId"
										:show-level="false"
										live-update-label=""
										rank-first
										show-player
										status-mode="all"
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
									<template #pending>
										<USkeleton class="min-h-80 w-full rounded-2xl" />
									</template>
									<LazyLevelTelemetryPanel
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
								<LazyLevelScoreBreakdown
									:model="levelData.scoreInsights.value"
									:points="summary.points"
									:vote-counts="levelData.voteDistribution.value"
									:labels="scoreBreakdownLabels"
								/>
							</section>
						</template>

						<template #ghosts>
							<ClientOnly>
								<LazyLevelGhostExplorerTab
									:active="ghostExplorerActive"
									:level-id="summary.id"
									:viewer-id="viewerId"
								/>
								<template #fallback>
									<USkeleton class="aspect-video min-h-80 w-full rounded-2xl" />
								</template>
							</ClientOnly>
						</template>
					</DetailSectionTabs>
				</div>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup vapor lang="ts">
const route = useRoute()
const { t, locale } = useI18n()
const session = useSessionStore()
const user = computed(() => session.user)
const xxHash = computed(() => String(route.params.xxh128))
const viewerId = computed(() => user.value?.id)
const levelData = useLevelDetail(xxHash, viewerId)
await levelData.prefetchCritical()
const summary = levelData.summary
const workshopUrl = computed(() =>
	summary.value?.publiclyVisible
		? steamWorkshopItemUrl(summary.value.workshopId)
		: undefined,
)
const telemetryModel = useLevelTelemetryModel(levelData.statistics.data)
const showViewerSplitComparison = ref(false)
type LevelDetailTab = 'records' | 'telemetry' | 'ghosts'
const activeDetailTab = ref<LevelDetailTab>('records')
const ghostExplorerActive = computed(() => activeDetailTab.value === 'ghosts')
const detailTabs = computed(() => [
	{ value: 'records' as const, label: t('levels.detail.tabs.records') },
	{ value: 'telemetry' as const, label: t('levels.detail.tabs.telemetry') },
	{ value: 'ghosts' as const, label: t('levels.detail.tabs.ghosts') },
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
	robots: () => (summary.value?.publiclyVisible === false ? 'noindex, nofollow' : 'index, follow'),
	title: () =>
		summary.value ? summary.value.name : t('pages.levels.seo.title'),
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
		casual: t('levels.detail.hero.competitivenessRatings.casual'),
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
const voteNumberFormat = computed(() => new Intl.NumberFormat(locale.value))
const scoreBreakdownLabels = computed(() => ({
	stages: {
		complexity: {
			title: t('levels.detail.scoreBreakdown.stages.complexity.title'),
			description: t('levels.detail.scoreBreakdown.stages.complexity.description'),
		},
		evidence: {
			title: t('levels.detail.scoreBreakdown.stages.evidence.title'),
			description: t('levels.detail.scoreBreakdown.stages.evidence.description'),
		},
		skill: {
			title: t('levels.detail.scoreBreakdown.stages.skill.title'),
			description: t('levels.detail.scoreBreakdown.stages.skill.description'),
		},
		quality: {
			title: t('levels.detail.scoreBreakdown.stages.quality.title'),
			description: t('levels.detail.scoreBreakdown.stages.quality.description'),
		},
		length: {
			title: t('levels.detail.scoreBreakdown.stages.length.title'),
			description: t('levels.detail.scoreBreakdown.stages.length.description'),
		},
		votes: {
			title: t('levels.detail.scoreBreakdown.stages.votes.title'),
			description: t('levels.detail.scoreBreakdown.stages.votes.description'),
		},
	},
	metrics: {
		competitiveMerit: t('levels.detail.scoreBreakdown.metrics.competitiveMerit'),
		complexityConfidence: t('levels.detail.scoreBreakdown.metrics.complexityConfidence'),
		complexityScore: t('levels.detail.scoreBreakdown.metrics.complexityScore'),
		evidenceModifier: t('levels.detail.scoreBreakdown.metrics.evidenceModifier'),
		fieldStrength: t('levels.detail.scoreBreakdown.metrics.fieldStrength'),
		lengthModifier: t('levels.detail.scoreBreakdown.metrics.lengthModifier'),
		qualityModifier: t('levels.detail.scoreBreakdown.metrics.qualityModifier'),
		qualityScore: t('levels.detail.scoreBreakdown.metrics.qualityScore'),
		skillAlignment: t('levels.detail.scoreBreakdown.metrics.skillAlignment'),
		skillConfidence: t('levels.detail.scoreBreakdown.metrics.skillConfidence'),
		skillSampleSize: t('levels.detail.scoreBreakdown.metrics.skillSampleSize'),
		skillScore: t('levels.detail.scoreBreakdown.metrics.skillScore'),
		skillSeparation: t('levels.detail.scoreBreakdown.metrics.skillSeparation'),
		voteAdjustment: t('levels.detail.scoreBreakdown.metrics.voteAdjustment'),
		worldRecordExcluded: t('levels.detail.scoreBreakdown.metrics.worldRecordExcluded'),
	},
	formula: {
		base: t('levels.detail.scoreBreakdown.formula.base'),
		result: t('levels.detail.scoreBreakdown.formula.result'),
		points: t('levels.detail.scoreBreakdown.formula.points'),
		summary: (values: {
			base: string
			quality: string
			evidence: string
			length: string
			votes: string
			result: string
		}) => t('levels.detail.scoreBreakdown.formula.summary', values),
	},
	votes: {
		title: t('levels.detail.scoreBreakdown.votes.title'),
		description: t('levels.detail.scoreBreakdown.votes.description'),
	},
	diagnostics: {
		title: t('levels.detail.scoreBreakdown.diagnostics.title'),
		description: t('levels.detail.scoreBreakdown.diagnostics.description'),
		observationOnly: t('levels.detail.scoreBreakdown.diagnostics.observationOnly'),
	},
	voteDistribution: {
		ariaLabel: t('levels.detail.scoreBreakdown.votes.ariaLabel'),
		empty: t('levels.detail.scoreBreakdown.votes.empty'),
		total: (count: number) =>
			t('levels.detail.scoreBreakdown.votes.total', {
				count: voteNumberFormat.value.format(count),
			}),
	},
	confidence: t('levels.detail.scoreBreakdown.confidence'),
	inspector: t('levels.detail.scoreBreakdown.inspector'),
	unavailable: t('levels.detail.scoreBreakdown.unavailable'),
	notAvailable: t('levels.detail.scoreBreakdown.notAvailable'),
	included: t('levels.detail.scoreBreakdown.included'),
	excluded: t('levels.detail.scoreBreakdown.excluded'),
}))
const recordLabels = computed(() => ({
	rank: t('common.rank'),
	player: t('common.user'),
	level: t('common.level'),
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
	date: t('common.set'),
	notRanked: t('common.unavailable'),
	decayPercentage: t('pages.records.table.decayPercentage'),
	openRecord: t('pages.records.table.openRecord', {
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
