<template>
	<section class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div><h2 class="text-2xl font-black text-highlighted">{{ $t('tournaments.ghosts.title') }}</h2><p class="mt-1 text-muted-foreground">{{ $t('tournaments.ghosts.description') }}</p></div>
			<UButton
				:icon="loaded ? (workspaceOpen ? 'i-tabler-chevron-up' : 'i-tabler-chevron-down') : 'i-tabler-ghost'"
				:disabled="!loaded && available.length === 0"
				@click="toggleWorkspace"
			>
				<template v-if="!loaded">
					{{ $t('tournaments.ghosts.load', { count: available.length }) }}
				</template>
				<template v-else-if="workspaceOpen">{{ $t('tournaments.ghosts.hide') }}</template>
				<template v-else>{{ $t('tournaments.ghosts.show') }}</template>
			</UButton>
		</div>
		<p v-if="missingCount" class="text-sm text-warning">{{ $t('tournaments.ghosts.missing', { count: missingCount }) }}</p>
		<div v-if="loaded" v-show="workspaceOpen">
			<ClientOnly>
				<LazyRecordReplayWorkspace
					:ghosts="playback.loaded.value"
					:level-blocks="geometry.blocks.value"
					:states="playback.states"
					:primary-record-id="sources[0]?.recordId ?? null"
					:follow-record-ids="sources.slice(0, 8).map((source) => source.recordId)"
					:active="workspaceActive"
					:bulk-mode="sources.length > 10"
					:loading-when-empty="loaded"
					:frame-rate="performance.frameRate.value"
					:quality="performance.renderQuality.value"
					:labels="replayLabels"
					@retry="$event.forEach(playback.retry)"
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
				</LazyRecordReplayWorkspace>
			</ClientOnly>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import type { GhostRecordSource } from '~/types/ghost'
import type { TournamentStanding } from '~/types/tournament'
import { orderTournamentGhostSources } from '~/utils/tournament'

const props = defineProps<{
	standings: TournamentStanding[]
	levelId: number
	missingCount: number
}>()
const { t, locale } = useI18n()
const sources = shallowRef<GhostRecordSource[]>([])
const workspaceOpen = ref(false)
const available = computed(() => orderTournamentGhostSources(props.standings))
const loaded = computed(() => sources.value.length > 0)
const workspaceActive = computed(() => loaded.value && workspaceOpen.value)
const levelId = computed(() => props.levelId)
const primaryColor = ref('#facc15')
const playback = useGhostPlaybackSources({
	active: workspaceActive,
	sources,
	identityLabels: {
		unknownPlayer: t('tournaments.unknownPlayer'),
		worldRecord: (name) => t('pages.recordDetail.replay.labels.worldRecord', { name }),
		personalBest: (name) => t('pages.recordDetail.replay.labels.personalBest', { name }),
		ordinal: (name, ordinal) => t('pages.recordDetail.replay.labels.ordinal', { name, ordinal }),
	},
	locale,
	primaryColor,
	fallbackPalette: ['#38bdf8', '#a78bfa', '#f472b6', '#4ade80', '#fb923c', '#22d3ee'],
})
const geometry = useRecordLevelGeometry(levelId, workspaceActive)
const performance = useGhostPerformancePreferences()
function toggleWorkspace() {
	if (!loaded.value) {
		sources.value = [...available.value]
		workspaceOpen.value = true
		return
	}
	workspaceOpen.value = !workspaceOpen.value
}
const replayLabels = computed(() => ({
	loadingTitle: t('pages.recordDetail.replay.loadingTitle'), loadingDescription: t('pages.recordDetail.replay.loadingDescription'), failedTitle: t('pages.recordDetail.replay.failedTitle'), failedDescription: (count: number) => t('pages.recordDetail.replay.failedDescription', { count }), retry: t('pages.recordDetail.replay.retry'),
	viewer: { frameRate: (current: number, target: number) => t('pages.recordDetail.replay.frameRateStatus', { current, target }), approximateGeometry: t('pages.recordDetail.replay.approximateGeometry'), emptyTitle: t('pages.recordDetail.replay.emptyTitle'), emptyDescription: t('pages.recordDetail.replay.emptyDescription'), contextLostTitle: t('pages.recordDetail.replay.contextLostTitle'), contextLostDescription: t('pages.recordDetail.replay.contextLostDescription'), unavailableTitle: t('pages.recordDetail.replay.unavailableTitle'), unavailableDescription: t('pages.recordDetail.replay.unavailableDescription') },
	controls: { play: t('pages.recordDetail.replay.controls.play'), pause: t('pages.recordDetail.replay.controls.pause'), timeline: t('pages.recordDetail.replay.controls.timeline'), previousFrame: t('pages.recordDetail.replay.controls.previousFrame'), nextFrame: t('pages.recordDetail.replay.controls.nextFrame'), speed: t('pages.recordDetail.replay.controls.speed'), loop: t('pages.recordDetail.replay.controls.loop'), orbit: t('pages.recordDetail.replay.controls.orbit'), isometric: t('pages.recordDetail.replay.controls.isometric'), follow: t('pages.recordDetail.replay.controls.follow'), frameRoute: t('pages.recordDetail.replay.controls.frameRoute'), fullScreen: t('pages.recordDetail.replay.controls.fullScreen'), exitFullScreen: t('pages.recordDetail.replay.controls.exitFullScreen') },
}))
const performanceLabels = computed(() => ({
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
