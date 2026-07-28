<template>
	<div class="space-y-4">
		<div v-if="active && ghosts.length === 0" class="grid aspect-video min-h-80 place-items-center rounded-2xl border border-border bg-card/60 p-6 text-center">
			<div>
				<TablerIcon
					:class="loading ? 'animate-spin text-primary motion-reduce:animate-none' : 'text-muted'"
					:name="loading ? 'loader-2' : 'ghost-off'"
					class="mx-auto size-10"
				/>
				<p class="mt-4 font-semibold text-highlighted">{{ loading ? labels.loadingTitle : labels.viewer.emptyTitle }}</p>
				<p class="mt-1 text-sm text-muted">{{ loading ? labels.loadingDescription : labels.viewer.emptyDescription }}</p>
			</div>
		</div>
		<GhostPlaybackViewer
			v-else-if="active"
			ref="viewer"
			:ghosts="ghosts"
			:level-blocks="levelBlocks"
			:current-time="currentTime"
			:playing="playing"
			:playback-rate="playbackRate"
			:loop="loop"
			:selected-record-id="selectedRecordId"
			:camera-mode="cameraMode"
			:following="following"
			:frame-rate="frameRate"
			:quality="quality"
			:bulk-mode="bulkMode"
			:bulk-ghost-count="states.size"
			:detailed-record-ids="followRecordIdList"
			:scene-revision="sceneRevision"
			:labels="labels.viewer"
			@update:current-time="currentTime = $event"
			@update:playing="setPlaying"
			@update:following="following = $event"
		/>
		<GhostPlaybackControls
			v-if="active && ghosts.length"
			v-model:current-time="currentTime"
			:playing="playing"
			v-model:playback-rate="playbackRate"
			v-model:loop="loop"
			v-model:camera-mode="cameraMode"
			:duration="duration"
			:labels="labels.controls"
			@update:playing="setPlaying"
			@step="step"
			@follow="viewer?.followSelected()"
			@frame-route="viewer?.frameRoute()"
		>
			<template #settings><slot name="settings" /></template>
		</GhostPlaybackControls>
		<GhostComparisonLegend
			v-if="active && followGhosts.length"
			:ghosts="followGhosts"
			:selected-record-id="selectedRecordId"
			@select="select"
		/>
		<UAlert
			v-if="active && failedCount"
			color="warning"
			icon="i-tabler-alert-triangle"
			:title="labels.failedTitle"
			:description="labels.failedDescription(failedCount)"
		>
			<template #actions>
				<UButton
					color="warning"
					variant="soft"
					icon="i-tabler-refresh"
					:label="labels.retry"
					@click="$emit('retry', failedRecordIds)"
				/>
			</template>
		</UAlert>
	</div>
</template>

<script setup vapor lang="ts">
import type {
	GhostCameraMode,
	GhostLevelBlock,
	GhostLoadState,
	LoadedPlaybackGhost,
} from '~/types/ghost'
import {
	resolveGhostPlaybackStartTime,
	resolveGhostSelectedRecordId,
} from '~/utils/ghostScene'

const props = withDefaults(defineProps<{
	ghosts: LoadedPlaybackGhost[]
	levelBlocks: GhostLevelBlock[]
	states: Map<number, GhostLoadState>
	primaryRecordId?: number | null
	followRecordIds?: number[]
	active?: boolean
	bulkMode?: boolean
	loadingWhenEmpty?: boolean
	sceneRevision?: number | string
	frameRate: 30 | 60
	quality: 'performance' | 'balanced' | 'quality'
	labels: {
		loadingTitle: string
		loadingDescription: string
		failedTitle: string
		failedDescription: (count: number) => string
		retry: string
		viewer: {
			frameRate: (value: number) => string
			approximateGeometry: string
			emptyTitle: string
			emptyDescription: string
			contextLostTitle: string
			contextLostDescription: string
			unavailableTitle: string
			unavailableDescription: string
		}
		controls: {
			play: string
			pause: string
			timeline: string
			previousFrame: string
			nextFrame: string
			speed: string
			loop: string
			orbit: string
			isometric: string
			follow: string
			frameRoute: string
		}
	}
}>(), {
	active: true,
	bulkMode: false,
	loadingWhenEmpty: true,
	primaryRecordId: null,
	sceneRevision: 0,
})

const emit = defineEmits<{
	retry: [recordIds: number[]]
	timeupdate: [time: number]
}>()

const viewer = useTemplateRef('viewer')
const currentTime = ref(0)
const playing = ref(false)
const playbackRate = ref(1)
const loop = ref(false)
const cameraMode = ref<GhostCameraMode>('orbit')
const following = ref(true)
const selectedRecordId = ref<number | null>(props.primaryRecordId)
const duration = computed(() => Math.max(0, ...props.ghosts.map(({ record }) => record.time)))
const followGhosts = computed(() => {
	if (props.followRecordIds === undefined) return props.ghosts
	const byId = new Map(props.ghosts.map((ghost) => [ghost.record.recordId, ghost]))
	const ordered = props.followRecordIds.flatMap((recordId) => {
		const ghost = byId.get(recordId)
		return ghost ? [ghost] : []
	})
	const orderedIds = new Set(ordered.map(({ record }) => record.recordId))
	const remaining = props.ghosts
		.filter(({ record }) => !orderedIds.has(record.recordId))
		.toSorted(
			(left, right) =>
				left.record.time - right.record.time || left.record.recordId - right.record.recordId,
		)
	return [...ordered, ...remaining].slice(0, 12)
})
const followRecordIdList = computed(() =>
	followGhosts.value.map(({ record }) => record.recordId),
)
const failedCount = computed(
	() => [...props.states.values()].filter((state) => state.status === 'error').length,
)
const failedRecordIds = computed(() =>
	[...props.states.entries()]
		.filter(([, state]) => state.status === 'error')
		.map(([recordId]) => recordId),
)
const loading = computed(
	() =>
		(props.loadingWhenEmpty && props.states.size === 0) ||
		[...props.states.values()].some((state) => state.status === 'loading'),
)

watch(
	() => props.primaryRecordId,
	(value) => {
		if (value !== null && value !== undefined) selectedRecordId.value = value
	},
)
watch(
	[
		() => followGhosts.value.map(({ record }) => record.recordId),
		() =>
			props.primaryRecordId === null || props.primaryRecordId === undefined
				? undefined
				: props.states.get(props.primaryRecordId)?.status,
	],
	([recordIds, primaryStatus]) => {
		selectedRecordId.value = resolveGhostSelectedRecordId(
			selectedRecordId.value,
			props.primaryRecordId,
			recordIds,
			primaryStatus === 'error',
		)
	},
	{ immediate: true },
)
watch(
	() => props.active,
	(active) => {
		if (!active) playing.value = false
	},
)
watch(duration, (value) => {
	currentTime.value = Math.min(currentTime.value, value)
})
watch(currentTime, (value) => emit('timeupdate', value))

function select(recordId: number) {
	selectedRecordId.value = recordId
	following.value = true
	nextTick(() => viewer.value?.frameSelected())
}

function step(direction: -1 | 1) {
	const selected = props.ghosts.find(({ record }) => record.recordId === selectedRecordId.value)
	if (!selected) return
	const frames = selected.ghost.frames
	if (direction < 0) {
		const frame = frames.toReversed().find(({ time }) => time < currentTime.value - 0.0001)
		currentTime.value = frame?.time ?? 0
	} else {
		const frame = frames.find(({ time }) => time > currentTime.value + 0.0001)
		currentTime.value = frame?.time ?? duration.value
	}
}

function seek(time: number, options: { pause?: boolean } = {}) {
	currentTime.value = Math.min(duration.value, Math.max(0, time))
	if (options.pause) playing.value = false
}

function setPlaying(value: boolean) {
	if (value) currentTime.value = resolveGhostPlaybackStartTime(currentTime.value, duration.value)
	playing.value = value
}

defineExpose({ seek })
</script>
