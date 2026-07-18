<template>
	<UContainer class="py-2">
		<DataState
			:pending="recordData.detail.fetching.value"
			:error="recordData.detail.error.value?.message"
			:empty="!recordData.detail.fetching.value && !record"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('pages.recordDetail.notFound')"
		>
			<div v-if="record && source && record.level" class="space-y-8 lg:space-y-10">
				<RecordDetailHero
					:record="source"
					:level-hash="record.level.xxHash"
					:level-name="levelName"
					:image-url="levelItem?.imageUrl"
					:game-version="record.gameVersion"
					:mod-version="record.modVersion"
					:ghost-version="record.recordStatistic?.ghostVersion"
					:level-rank="contribution?.levelPosition"
					:ranked-points="contribution?.playerDecayedPoints"
					:labels="heroLabels"
				/>

				<section
					ref="replaySection"
					class="scroll-mt-20 lg:scroll-mt-24"
					aria-labelledby="replay-heading"
				>
					<SectionHeader
						id="replay-heading"
						:title="$t('pages.recordDetail.replay.title')"
						:description="$t('pages.recordDetail.replay.description')"
					/>
					<ClientOnly>
						<RecordReplayWorkspace
							ref="replayWorkspace"
							:ghosts="playback.loaded.value"
							:level-blocks="levelGeometry.blocks.value"
							:states="playback.states"
							:primary-record-id="recordId"
							:frame-rate="performance.frameRate.value"
							:quality="performance.renderQuality.value"
							:labels="replayLabels"
							@retry="$event.forEach(playback.retry)"
							@timeupdate="replayTime = $event"
						>
							<template #settings>
								<GhostPerformanceSettings
									:preferences="performance.preferences.value"
									:cache-stats="performance.cacheStats.value"
									:cache-pending="performance.cachePending.value"
									:labels="performanceLabels"
									@update:frame-rate="performance.setFrameRate"
									@update:render-quality="performance.setRenderQuality"
									@clear-cache="performance.clearCache"
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

				<section aria-labelledby="comparison-heading">
					<SectionHeader
						id="comparison-heading"
						:title="$t('pages.recordDetail.comparisons.title')"
						:description="$t('pages.recordDetail.comparisons.description')"
					/>
					<RecordComparisonPicker
						:world-record="recordData.worldRecord.value"
						:viewer-personal-best="comparisons.catalog.value.viewerPersonalBest"
						:selected="selectedSources"
						:users="comparisons.users.value"
						:search="comparisons.search.value"
						:search-pending="comparisons.userSearchQuery.fetching.value"
						:labels="comparisonLabels"
						@update:search="comparisons.search.value = $event"
						@toggle="toggleComparison"
						@select-top="selectTopPlayers"
						@select-owner="selectOwnerRuns"
						@clear="setComparisonIds([])"
					/>
				</section>

				<RecordCapabilityNotice
					v-if="primaryGhost"
					:version="primaryGhost.version"
					:capabilities="primaryGhost.capabilities"
					:labels="capabilityLabels"
				/>

				<section
					v-if="checkpointAnalysis.series.length"
					aria-labelledby="checkpoint-analysis-heading"
				>
					<SectionHeader
						id="checkpoint-analysis-heading"
						:title="$t('pages.recordDetail.checkpoints.title')"
						:description="$t('pages.recordDetail.checkpoints.description')"
					/>
					<LevelSplitAnalysis :analysis="checkpointAnalysis" :labels="checkpointLabels" />
				</section>

				<section v-if="record.recordStatistic" aria-labelledby="record-statistics-heading">
					<SectionHeader
						id="record-statistics-heading"
						:title="$t('pages.recordDetail.telemetry.title')"
						:description="$t('pages.recordDetail.telemetry.description')"
					/>
					<RecordTelemetryPanel
						:model="statisticTelemetry"
						:description="$t('pages.recordDetail.telemetry.versionDescription')"
					/>
				</section>

				<RecordTelemetryCharts
					v-if="primaryGhost"
					:ghost="primaryGhost"
					:comparisons="comparisonGhosts"
					:labels="analysisLabels.telemetry"
				/>

				<RecordEventTimeline
					v-if="primaryGhost"
					:events="timelineEvents"
					:duration="source.time"
					:current-time="replayTime"
					:labels="analysisLabels.events"
					@seek="seekAnalysisEvent"
				/>

				<RecordAirControlAnalysis
					v-if="primaryGhost"
					:runs="airControlRuns"
					:labels="analysisLabels.airControl"
				/>

				<RecordDriftAnalysis
					v-if="primaryGhost"
					:events="slipEvents"
					:comparison-runs="comparisonDriftRuns"
					:labels="analysisLabels.drift"
					@seek="seekAnalysisEvent"
				/>

				<RecordCoachingInsights
					v-if="primaryGhost"
					:insights="coachingInsights"
					:labels="analysisLabels.coaching"
					@seek="seekAnalysisEvent"
				/>
			</div>
		</DataState>
	</UContainer>
</template>

<script setup lang="ts">
import type { GhostRecordSource } from '~/types/ghost'
import { buildGhostSlipEvents, buildGhostTimelineEvents } from '~/utils/ghostAnalysis'
import { buildLevelSplitAnalysis, resolveGhostFinishSpeed } from '~/utils/levelSplitAnalysis'
import { buildRecordAirControlRuns, buildRecordDriftRuns } from '~/utils/recordGhostAnalysis'

definePageMeta({ key: (route) => String(route.params.recordId) })

const route = useRoute()
const { t, locale } = useI18n()
const session = useSessionStore()
const rawRecordId = route.params.recordId
const parsedRecordId =
	typeof rawRecordId === 'string' && /^\d+$/.test(rawRecordId) ? Number(rawRecordId) : null
if (parsedRecordId === null || !Number.isSafeInteger(parsedRecordId) || parsedRecordId < 1) {
	throw createError({ statusCode: 404, statusMessage: t('pages.recordDetail.notFound') })
}
const recordId = parsedRecordId
const recordIdRef = computed(() => recordId)
const recordData = useRecordDetail(recordIdRef)
await recordData.prefetchCritical()
const record = recordData.record
const source = recordData.source
const levelItem = recordData.levelItem
if (import.meta.server && !record.value && !recordData.detail.error.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.recordDetail.notFound') })
}

const levelId = computed(() => record.value?.levelId)
const ownerId = computed(() => record.value?.userId)
const viewerId = computed(() => session.user?.id)
const selectedRecordIds = computed(() => parseComparisonIds(route.query.compare))
const comparisons = useRecordComparisons({ levelId, ownerId, viewerId, selectedRecordIds })
const levelGeometry = useRecordLevelGeometry(levelId)
const contribution = computed(() => record.value?.userPointContributions.nodes[0] ?? null)
const levelName = computed(() => levelItem.value?.name ?? t('pages.recordDetail.unknownLevel'))

const sourceRegistry = computed(() => {
	const values = [
		source.value,
		recordData.worldRecord.value,
		comparisons.catalog.value.viewerPersonalBest,
		...comparisons.catalog.value.topPersonalBests,
		...comparisons.catalog.value.ownerRuns,
		...comparisons.comparisons.value,
	].filter((value): value is GhostRecordSource => value !== null)
	return new Map(values.map((value) => [value.recordId, value]))
})
const selectedSources = computed(() =>
	selectedRecordIds.value.flatMap((id) => {
		const value = sourceRegistry.value.get(id)
		return value && value.recordId !== recordId ? [value] : []
	}),
)
const playbackSources = computed(() =>
	[source.value, ...selectedSources.value]
		.filter((value): value is GhostRecordSource => value !== null)
		.filter((value, index, values) => values.findIndex(({ recordId: id }) => id === value.recordId) === index)
		.slice(0, 11),
)

const primaryColor = ref('#facc15')
const playback = useGhostPlaybackSources({
	sources: playbackSources,
	identityLabels: {
		unknownPlayer: t('pages.recordDetail.unknownPlayer'),
		worldRecord: (name) => t('pages.recordDetail.replay.labels.worldRecord', { name }),
		personalBest: (name) => t('pages.recordDetail.replay.labels.personalBest', { name }),
		ordinal: (name, ordinal) => t('pages.recordDetail.replay.labels.ordinal', { name, ordinal }),
	},
	locale,
	primaryColor,
	fallbackPalette: ['#38bdf8', '#a78bfa', '#f472b6', '#4ade80', '#fb923c', '#22d3ee'],
})
const performance = useGhostPerformancePreferences()
const replayWorkspace = useTemplateRef('replayWorkspace')
const replaySection = useTemplateRef('replaySection')
const replayTime = ref(0)
const primaryGhost = computed(() => playback.parsed.get(recordId) ?? null)
const recordStatistic = computed(() => record.value?.recordStatistic)
const statisticTelemetry = useSingleRecordTelemetryModel(recordStatistic)
const comparisonGhosts = computed(() => playback.loaded.value.filter(({ record: value }) => value.recordId !== recordId))
const timelineEvents = computed(() => buildGhostTimelineEvents(primaryGhost.value?.frames ?? []))
const slipEvents = computed(() => buildGhostSlipEvents(primaryGhost.value?.frames ?? []))
const comparisonDriftRuns = computed(() => buildRecordDriftRuns(comparisonGhosts.value))
const airControlRuns = computed(() => buildRecordAirControlRuns(playback.loaded.value, recordId))
const checkpointAnalysis = computed(() =>
	buildLevelSplitAnalysis(
		playbackSources.value.map((value) => ({
			id: value.recordId,
			time: value.time,
			splits: value.splits,
			speeds: value.speeds,
			finishSpeed: resolveGhostFinishSpeed(playback.parsed.get(value.recordId)?.frames ?? []),
			user: { steamId: value.userSteamId, steamName: value.userName },
		})),
	),
)
const coachingInsights = computed(() =>
	primaryGhost.value
		? buildRecordCoachingInsights(primaryGhost.value, comparisonGhosts.value)
		: [],
)

function parseComparisonIds(value: unknown): number[] {
	const text = Array.isArray(value) ? value.join(',') : String(value ?? '')
	return [...new Set(text.split(',').map(Number).filter((id) => Number.isSafeInteger(id) && id > 0 && id !== recordId))].slice(0, 10)
}

function setComparisonIds(ids: readonly number[]) {
	const normalized = [...new Set(ids.filter((id) => id !== recordId))].slice(0, 10)
	void navigateTo({
		path: route.path,
		query: { ...route.query, compare: normalized.length ? normalized.join(',') : undefined },
	}, { replace: true })
}

function toggleComparison(id: number) {
	const next = selectedRecordIds.value.includes(id)
		? selectedRecordIds.value.filter((value) => value !== id)
		: [...selectedRecordIds.value, id]
	setComparisonIds(next)
}

function selectTopPlayers(count: number) {
	setComparisonIds(comparisons.catalog.value.topPersonalBests.slice(0, count).map(({ recordId: id }) => id))
}

function selectOwnerRuns(count: number) {
	setComparisonIds(comparisons.catalog.value.ownerRuns.slice(0, count).map(({ recordId: id }) => id))
}

function seekAnalysisEvent(time: number) {
	replayWorkspace.value?.seek(time, { pause: true })
	void nextTick(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		replaySection.value?.scrollIntoView({
			behavior: reducedMotion ? 'auto' : 'smooth',
			block: 'start',
		})
	})
}

useSeoMeta({
	title: () => t('pages.recordDetail.seo.title', { id: recordId }),
	description: () =>
		record.value
			? t('pages.recordDetail.seo.recordDescription', {
				player: record.value.user?.steamName ?? t('pages.recordDetail.unknownPlayer'),
				level: levelName.value,
			})
			: t('pages.recordDetail.seo.description'),
})
useSchemaOrg([defineWebPage({ name: () => t('pages.recordDetail.seo.title', { id: recordId }) })])

const heroLabels = computed(() => ({
	worldRecord: t('common.worldRecord'),
	personalBest: t('common.personalBest'),
	record: (id: number) => t('pages.recordDetail.hero.record', { id }),
	recordTime: t('pages.recordDetail.hero.recordTime'),
	unknownPlayer: t('pages.recordDetail.unknownPlayer'),
	set: t('pages.recordDetail.hero.set'),
	gameVersion: t('pages.recordDetail.hero.gameVersion'),
	modVersion: t('pages.recordDetail.hero.modVersion'),
	ghostVersion: t('pages.recordDetail.hero.ghostVersion'),
	levelRank: t('pages.recordDetail.hero.levelRank'),
	rankedPoints: t('pages.recordDetail.hero.rankedPoints'),
	unavailable: t('common.unavailable'),
}))

const replayLabels = computed(() => ({
	loadingTitle: t('pages.recordDetail.replay.loadingTitle'),
	loadingDescription: t('pages.recordDetail.replay.loadingDescription'),
	failedTitle: t('pages.recordDetail.replay.failedTitle'),
	failedDescription: (count: number) => t('pages.recordDetail.replay.failedDescription', { count }),
	retry: t('pages.recordDetail.replay.retry'),
	viewer: {
		grid: t('pages.recordDetail.replay.grid'),
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

const performanceLabels = computed(() => ({
	open: t('pages.recordDetail.performance.open'),
	title: t('pages.recordDetail.performance.title'),
	description: t('pages.recordDetail.performance.description'),
	frameRate: t('pages.recordDetail.performance.frameRate'),
	quality: t('pages.recordDetail.performance.quality'),
	auto: t('common.auto'),
	fps30: t('pages.recordDetail.performance.fps30'),
	fps60: t('pages.recordDetail.performance.fps60'),
	performance: t('pages.recordDetail.performance.performance'),
	balanced: t('pages.recordDetail.performance.balanced'),
	qualityHigh: t('pages.recordDetail.performance.qualityHigh'),
	cache: t('pages.recordDetail.performance.cache'),
	cacheValue: (entries: string, size: string) => t('pages.recordDetail.performance.cacheValue', { entries, size }),
	clearCache: t('pages.recordDetail.performance.clearCache'),
	unavailable: t('common.unavailable'),
}))

const comparisonLabels = computed(() => ({
	quickComparisons: t('pages.recordDetail.comparisons.quickComparisons'),
	quickDescription: t('pages.recordDetail.comparisons.quickDescription'),
	worldRecord: t('common.worldRecord'),
	myPersonalBest: t('pages.recordDetail.comparisons.myPersonalBest'),
	presets: t('pages.recordDetail.comparisons.presets'),
	presetsDescription: t('pages.recordDetail.comparisons.presetsDescription'),
	topPlayers: (count: number) => t('pages.recordDetail.comparisons.topPlayers', { count }),
	ownerRuns: (count: number) => t('pages.recordDetail.comparisons.ownerRuns', { count }),
	searchLabel: t('pages.recordDetail.comparisons.searchLabel'),
	searchPlaceholder: t('pages.recordDetail.comparisons.searchPlaceholder'),
	searching: t('common.loading'),
	noPersonalBest: t('pages.recordDetail.comparisons.noPersonalBest'),
	selected: t('pages.recordDetail.comparisons.selected'),
	selectedCount: (count: number) => t('pages.recordDetail.comparisons.selectedCount', { count }),
	clear: t('common.clear'),
	remove: t('common.remove'),
	noneSelected: t('pages.recordDetail.comparisons.noneSelected'),
	unknownPlayer: t('pages.recordDetail.unknownPlayer'),
}))

const capabilityLabels = computed(() => createRecordCapabilityLabels(t))
const analysisLabels = computed(() => createRecordAnalysisLabels(t))
const checkpointLabels = computed(() => ({
	checkpoint: t('pages.recordDetail.checkpoints.checkpoint'),
	finish: t('common.finish'),
	deltaTitle: t('pages.recordDetail.checkpoints.deltaTitle'),
	deltaDescription: t('pages.recordDetail.checkpoints.deltaDescription'),
	speedTitle: t('pages.recordDetail.checkpoints.speedTitle'),
	speedDescription: t('pages.recordDetail.checkpoints.speedDescription'),
	secondsUnit: t('dashboard.totals.units.seconds'),
	speedUnit: t('dashboard.totals.units.kilometresPerHour'),
}))
</script>
