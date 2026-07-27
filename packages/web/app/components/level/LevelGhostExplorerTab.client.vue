<template>
	<div class="space-y-8 lg:space-y-10">
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
			<LazyRecordReplayWorkspace
				:ghosts="ghostPlayback.loaded.value"
				:level-blocks="ghostLevelGeometry.blocks.value"
				:states="ghostPlayback.states"
				:primary-record-id="ghostFollowRecordIds[0] ?? null"
				:follow-record-ids="ghostFollowRecordIds"
				:active="active"
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
			</LazyRecordReplayWorkspace>
		</section>
	</div>
</template>

<script setup vapor lang="ts">
import type { LevelGhostPresetCount, LevelGhostPresetKind } from '~/types/levelGhostExplorer'
import {
	buildLevelGhostFollowRecordIds,
	LEVEL_GHOST_FOLLOW_LIMIT,
} from '~/utils/levelGhostSelection'

const props = defineProps<{
	active: boolean
	levelId: number
	viewerId?: number
}>()
const { t, locale } = useI18n()
const active = computed(() => props.active)
const levelId = computed(() => props.levelId)
const viewerId = computed(() => props.viewerId)
const ghostExplorer = useLevelGhostExplorer({ active, levelId, viewerId })
const ghostPrimaryColor = ref('#facc15')
const ghostPlayback = useGhostPlaybackSources({
	active,
	sources: ghostExplorer.activeSources,
	identityLabels: {
		unknownPlayer: t('levels.detail.ghostExplorer.unknownPlayer'),
		worldRecord: (name) => t('pages.recordDetail.replay.labels.worldRecord', { name }),
		personalBest: (name) => t('pages.recordDetail.replay.labels.personalBest', { name }),
		ordinal: (name, ordinal) =>
			t('pages.recordDetail.replay.labels.ordinal', { name, ordinal }),
	},
	locale,
	primaryColor: ghostPrimaryColor,
	fallbackPalette: ['#38bdf8', '#a78bfa', '#f472b6', '#4ade80', '#fb923c', '#22d3ee'],
})
const ghostLevelGeometry = useRecordLevelGeometry(levelId, active)
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
