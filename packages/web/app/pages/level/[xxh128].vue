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
									<RecordHistoryTable
										:records="levelData.personalBestRows.value"
										:labels="recordLabels"
										:viewer-user-id="viewerId"
										:show-level="false"
										live-update-label=""
										rank-first
										show-player
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
									<RecordHistoryTable
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
									:points="summary.points"
									:vote-counts="levelData.voteDistribution.value"
									:labels="scoreBreakdownLabels"
								/>
							</section>
						</template>

						<template #ghosts>
							<section aria-labelledby="ghost-explorer-heading">
								<SectionHeader
									id="ghost-explorer-heading"
									:title="$t('levels.detail.ghostExplorer.title')"
									:description="$t('levels.detail.ghostExplorer.description')"
								/>
								<LevelGhostExplorerPicker
									:world-record="ghostExplorer.worldRecord.value"
									:viewer-personal-best="ghostExplorer.viewerPersonalBest.value"
									:selected="ghostExplorer.activeSources.value"
									:users="ghostExplorer.users.value"
									:search="ghostExplorer.search.value"
									:search-pending="ghostExplorer.userSearchQuery.fetching.value"
									:preset-pending="ghostExplorer.presetPending.value"
									:loaded-count="ghostPlayback.loaded.value.length"
									:loading-count="ghostLoadingCount"
									:failed-count="ghostFailedRecordIds.length"
									:bulk-locked="ghostExplorer.bulkLocked.value"
									:follow-limit="LEVEL_GHOST_FOLLOW_LIMIT"
									:presets="ghostPresetGroups"
									:labels="ghostPickerLabels"
									@update:search="ghostExplorer.search.value = $event"
									@add="ghostExplorer.addSource"
									@remove="ghostExplorer.removeSource"
									@load-preset="loadGhostPreset"
									@clear="ghostExplorer.clearAll"
								/>
								<UAlert
									v-if="ghostExplorerError"
									class="mt-4"
									color="error"
									variant="subtle"
									icon="i-tabler-alert-circle"
									:title="$t('common.error')"
									:description="ghostExplorerError"
								/>
							</section>

							<section aria-labelledby="ghost-replay-heading">
								<SectionHeader
									id="ghost-replay-heading"
									:title="$t('pages.recordDetail.replay.title')"
									:description="$t('pages.recordDetail.replay.description')"
								/>
								<ClientOnly>
									<RecordReplayWorkspace
										:ghosts="ghostPlayback.loaded.value"
										:level-blocks="ghostLevelGeometry.blocks.value"
										:states="ghostPlayback.states"
										:primary-record-id="ghostFollowRecordIds[0] ?? null"
										:follow-record-ids="ghostFollowRecordIds"
										:active="ghostExplorerActive"
										:bulk-mode="ghostExplorer.bulkLocked.value"
										:loading-when-empty="ghostExplorer.defaultsQuery.fetching.value"
										:scene-revision="ghostExplorer.sceneRevision.value"
										:frame-rate="ghostPerformance.frameRate.value"
										:quality="ghostPerformance.renderQuality.value"
										:labels="ghostReplayLabels"
										@retry="$event.forEach(ghostPlayback.retry)"
									>
										<template #settings>
											<GhostPerformanceSettings
												:preferences="ghostPerformance.preferences.value"
												:cache-stats="ghostPerformance.cacheStats.value"
												:cache-pending="ghostPerformance.cachePending.value"
												:labels="ghostPerformanceLabels"
												@update:frame-rate="ghostPerformance.setFrameRate"
												@update:render-quality="ghostPerformance.setRenderQuality"
												@clear-cache="ghostPerformance.clearCache"
											/>
										</template>
									</RecordReplayWorkspace>
									<template #fallback>
										<div class="grid aspect-video min-h-80 place-items-center rounded-2xl border border-border bg-card/60">
											<TablerIcon name="loader-2" class="size-10 animate-spin text-primary motion-reduce:animate-none" />
										</div>
									</template>
								</ClientOnly>
							</section>
						</template>
					</DetailSectionTabs>
				</div>
			</template>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
import type { LevelGhostPresetCount, LevelGhostPresetKind } from '~/types/levelGhostExplorer'
import {
	buildLevelGhostFollowRecordIds,
	LEVEL_GHOST_FOLLOW_LIMIT,
} from '~/utils/levelGhostSelection'

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
const ghostLevelId = computed(() => summary.value?.id)
const ghostExplorer = useLevelGhostExplorer({
	active: ghostExplorerActive,
	levelId: ghostLevelId,
	viewerId,
})
const ghostPrimaryColor = ref('#facc15')
const ghostPlayback = useGhostPlaybackSources({
	sources: ghostExplorer.activeSources,
	identityLabels: {
		unknownPlayer: t('levels.detail.ghostExplorer.unknownPlayer'),
		worldRecord: (name) => t('pages.recordDetail.replay.labels.worldRecord', { name }),
		personalBest: (name) => t('pages.recordDetail.replay.labels.personalBest', { name }),
		ordinal: (name, ordinal) => t('pages.recordDetail.replay.labels.ordinal', { name, ordinal }),
	},
	locale,
	primaryColor: ghostPrimaryColor,
	fallbackPalette: ['#38bdf8', '#a78bfa', '#f472b6', '#4ade80', '#fb923c', '#22d3ee'],
})
const ghostLevelGeometry = useRecordLevelGeometry(ghostLevelId, ghostExplorerActive)
const ghostPerformance = useGhostPerformancePreferences()
const ghostFailedRecordIds = computed(() =>
	[...ghostPlayback.states.entries()]
		.filter(([, state]) => state.status === 'error')
		.map(([recordId]) => recordId),
)
const ghostLoadingCount = computed(
	() =>
		[...ghostPlayback.states.values()].filter(
			(state) => state.status === 'idle' || state.status === 'loading',
		).length,
)
const ghostExplorerError = computed(
	() =>
		ghostExplorer.defaultsQuery.error.value?.message ??
		ghostExplorer.presetError.value?.message ??
		ghostExplorer.userSearchQuery.error.value?.message ??
		null,
)
const ghostFollowRecordIds = computed(() =>
	buildLevelGhostFollowRecordIds({
		sources: ghostExplorer.activeSources.value,
		viewerPersonalBest: ghostExplorer.viewerPersonalBest.value,
		worldRecord: ghostExplorer.worldRecord.value,
		unavailableRecordIds: new Set(ghostFailedRecordIds.value),
	}),
)
const ghostPresetGroups = computed(() => {
	const groups: Array<{
		kind: LevelGhostPresetKind
		label: string
		description: string
	}> = [
		{
			kind: 'personal-bests',
			label: t('levels.detail.ghostExplorer.topPersonalBests'),
			description: t('levels.detail.ghostExplorer.topPersonalBestsDescription'),
		},
		{
			kind: 'global-records',
			label: t('levels.detail.ghostExplorer.fastestRecords'),
			description: t('levels.detail.ghostExplorer.fastestRecordsDescription'),
		},
	]
	if (viewerId.value !== undefined) {
		groups.push({
			kind: 'viewer-records',
			label: t('levels.detail.ghostExplorer.viewerFastestRecords'),
			description: t('levels.detail.ghostExplorer.viewerFastestRecordsDescription'),
		})
	}
	return groups
})

function loadGhostPreset(kind: LevelGhostPresetKind, count: LevelGhostPresetCount) {
	void ghostExplorer.loadPreset(kind, count)
}
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
const ghostPickerLabels = computed(() => ({
	quickTitle: t('levels.detail.ghostExplorer.quickTitle'),
	quickDescription: t('levels.detail.ghostExplorer.quickDescription'),
	worldRecord: t('levels.detail.ghostExplorer.worldRecord'),
	viewerPersonalBest: t('levels.detail.ghostExplorer.viewerPersonalBest'),
	presetsTitle: t('levels.detail.ghostExplorer.presetsTitle'),
	presetsDescription: t('levels.detail.ghostExplorer.presetsDescription'),
	countLabel: t('levels.detail.ghostExplorer.countLabel'),
	loadPreset: t('levels.detail.ghostExplorer.loadPreset'),
	loadingPreset: t('levels.detail.ghostExplorer.loadingPreset'),
	searchTitle: t('levels.detail.ghostExplorer.searchTitle'),
	searchDescription: t('levels.detail.ghostExplorer.searchDescription'),
	searchLabel: t('levels.detail.ghostExplorer.searchLabel'),
	searchPlaceholder: t('levels.detail.ghostExplorer.searchPlaceholder'),
	searching: t('levels.detail.ghostExplorer.searching'),
	activeTitle: t('levels.detail.ghostExplorer.activeTitle'),
	activeCount: (count: number) => t('levels.detail.ghostExplorer.activeCount', { count }),
	progress: (loaded: number, loading: number, failed: number) =>
		t('levels.detail.ghostExplorer.progress', { loaded, loading, failed }),
	noneSelected: t('levels.detail.ghostExplorer.noneSelected'),
	clearAll: t('levels.detail.ghostExplorer.clearAll'),
	remove: t('levels.detail.ghostExplorer.remove'),
	bulkTitle: t('levels.detail.ghostExplorer.bulkTitle'),
	bulkDescription: t('levels.detail.ghostExplorer.bulkDescription'),
	followLimit: t('levels.detail.ghostExplorer.followLimit'),
	unknownPlayer: t('levels.detail.ghostExplorer.unknownPlayer'),
}))
const ghostReplayLabels = computed(() => ({
	loadingTitle: t('pages.recordDetail.replay.loadingTitle'),
	loadingDescription: t('pages.recordDetail.replay.loadingDescription'),
	failedTitle: t('pages.recordDetail.replay.failedTitle'),
	failedDescription: (count: number) =>
		t('pages.recordDetail.replay.failedDescription', { count }),
	retry: t('pages.recordDetail.replay.retry'),
	viewer: {
		frameRate: (value: number) => t('pages.recordDetail.replay.frameRate', { value }),
		approximateGeometry: t('pages.recordDetail.replay.approximateGeometry'),
		emptyTitle: t('pages.recordDetail.replay.emptyTitle'),
		emptyDescription: t('pages.recordDetail.replay.emptyDescription'),
		contextLostTitle: t('pages.recordDetail.replay.contextLostTitle'),
		contextLostDescription: t('pages.recordDetail.replay.contextLostDescription'),
		unavailableTitle: t('pages.recordDetail.replay.unavailableTitle'),
		unavailableDescription: t('pages.recordDetail.replay.unavailableDescription'),
	},
	controls: {
		play: t('pages.recordDetail.replay.controls.play'),
		pause: t('pages.recordDetail.replay.controls.pause'),
		timeline: t('pages.recordDetail.replay.controls.timeline'),
		previousFrame: t('pages.recordDetail.replay.controls.previousFrame'),
		nextFrame: t('pages.recordDetail.replay.controls.nextFrame'),
		speed: t('pages.recordDetail.replay.controls.speed'),
		loop: t('pages.recordDetail.replay.controls.loop'),
		orbit: t('pages.recordDetail.replay.controls.orbit'),
		isometric: t('pages.recordDetail.replay.controls.isometric'),
		follow: t('pages.recordDetail.replay.controls.follow'),
		frameRoute: t('pages.recordDetail.replay.controls.frameRoute'),
	},
}))
const ghostPerformanceLabels = computed(() => ({
	open: t('pages.recordDetail.performance.open'),
	title: t('pages.recordDetail.performance.title'),
	description: t('pages.recordDetail.performance.description'),
	frameRate: t('pages.recordDetail.performance.frameRate'),
	quality: t('pages.recordDetail.performance.quality'),
	auto: t('common.auto'),
	fps30: t('pages.recordDetail.replay.frameRate', { value: 30 }),
	fps60: t('pages.recordDetail.replay.frameRate', { value: 60 }),
	performance: t('pages.recordDetail.performance.performance'),
	balanced: t('pages.recordDetail.performance.balanced'),
	qualityHigh: t('pages.recordDetail.performance.qualityHigh'),
	cache: t('pages.recordDetail.performance.cache'),
	cacheValue: (entries: string, size: string) =>
		t('pages.recordDetail.performance.cacheValue', { entries, size }),
	clearCache: t('pages.recordDetail.performance.clearCache'),
	unavailable: t('common.unavailable'),
}))
</script>
