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
				/>
			</ClientOnly>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import type { GhostRecordSource } from '~/types/ghost'
import type { TournamentStanding } from '~/types/tournament'

const props = defineProps<{ standings: TournamentStanding[]; levelId: number }>()
const { t, locale } = useI18n()
const sources = shallowRef<GhostRecordSource[]>([])
const workspaceOpen = ref(false)
const available = computed(() => props.standings.flatMap((row) => row.ghost?.ghostUrl ? [row.ghost] : []).slice(0, 200))
const missingCount = computed(() => props.standings.length - available.value.length)
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
	viewer: { frameRate: (value: number) => t('pages.recordDetail.replay.frameRate', { value }), approximateGeometry: t('pages.recordDetail.replay.approximateGeometry'), emptyTitle: t('pages.recordDetail.replay.emptyTitle'), emptyDescription: t('pages.recordDetail.replay.emptyDescription'), contextLostTitle: t('pages.recordDetail.replay.contextLostTitle'), contextLostDescription: t('pages.recordDetail.replay.contextLostDescription'), unavailableTitle: t('pages.recordDetail.replay.unavailableTitle'), unavailableDescription: t('pages.recordDetail.replay.unavailableDescription') },
	controls: { play: t('pages.recordDetail.replay.controls.play'), pause: t('pages.recordDetail.replay.controls.pause'), timeline: t('pages.recordDetail.replay.controls.timeline'), previousFrame: t('pages.recordDetail.replay.controls.previousFrame'), nextFrame: t('pages.recordDetail.replay.controls.nextFrame'), speed: t('pages.recordDetail.replay.controls.speed'), loop: t('pages.recordDetail.replay.controls.loop'), orbit: t('pages.recordDetail.replay.controls.orbit'), isometric: t('pages.recordDetail.replay.controls.isometric'), follow: t('pages.recordDetail.replay.controls.follow'), frameRoute: t('pages.recordDetail.replay.controls.frameRoute') },
}))
</script>
