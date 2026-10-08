<script setup vapor lang="ts">
import { parseGhostInWorker } from '~/composables/useGhostParserWorker.client'
import type { LoadedPlaybackGhost } from '~/types/ghost'
import { parseLevelGeometryBlocks } from '~/utils/ghostLevelGeometry'
import type { ValidationAttempt, ValidationReport, ValidationReview } from '~~/shared/ghostValidation'

const props = defineProps<{ recordId: number; attempts: ValidationAttempt[] }>()
const { t } = useI18n()
const performance = useGhostPerformancePreferences()
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
	realMaterialColours: t('pages.recordDetail.performance.realMaterialColours'),
	levelGeometry: t('pages.recordDetail.performance.levelGeometry'),
	ghostTrails: t('pages.recordDetail.performance.ghostTrails'),
	cache: t('pages.recordDetail.performance.cache'),
	cacheValue: (entries: string, size: string) => t('pages.recordDetail.performance.cacheValue', { entries, size }),
	clearCache: t('pages.recordDetail.performance.clearCache'),
	unavailable: t('common.unavailable'),
}))
const review = shallowRef<ValidationReview | null>(null)
const ghosts = shallowRef<LoadedPlaybackGhost[]>([])
const selectedSnapshot = shallowRef('')
const time = shallowRef(0)
const playing = shallowRef(false)
const following = shallowRef(false)
const error = shallowRef('')
const comparison = shallowRef<ValidationReport | null>(null)
const comparing = shallowRef(false)
const snapshot = computed(() => review.value?.snapshots.find((s) => String(s.snapshot.id) === selectedSnapshot.value))
const snapshotItems = computed(() => review.value?.snapshots.map(candidate => ({ label: candidate.snapshot.canonicalHash, value: String(candidate.snapshot.id) })) ?? [])
const blocks = computed(() => parseLevelGeometryBlocks(snapshot.value?.snapshot.blocks))
const assetUrl = computed(() => `/api/admin/ghost-validation/records/${props.recordId}/meshes/${selectedSnapshot.value}`)
const selectedReport = computed(() => comparison.value ?? (String(review.value?.record.levelId) === selectedSnapshot.value ? (review.value?.attempts ?? props.attempts).find(a => a.id_record === props.recordId)?.report : null))
const overlays = computed(() => snapshot.value?.overlays.map((o) => ({ ...o, color: o.finish ? '#60a5fa' : selectedReport.value?.missingGroups.some((group) => group.includes(o.uid)) ? '#f87171' : selectedReport.value?.matchedGroups.some((group) => group.includes(o.uid)) ? '#4ade80' : '#94a3b8' })) ?? [])
const labels = { frameRate: (current: number, target: number) => `${current}/${target} FPS`, approximateGeometry: 'Level geometry', emptyTitle: 'No ghost', emptyDescription: 'Ghost evidence unavailable', contextLostTitle: 'Graphics context lost', contextLostDescription: 'Reload review', unavailableTitle: 'Viewer unavailable', unavailableDescription: 'Graphics initialization failed' }

watch(() => props.recordId, async (recordId, _, onCleanup) => {
	let active = true
	onCleanup(() => { active = false })
	ghosts.value = []; review.value = null; comparison.value = null; error.value = ''; time.value = 0
	try {
		const data = await $fetch<ValidationReview>(`/api/admin/ghost-validation/records/${recordId}`)
		if (!active) return
		review.value = data
		selectedSnapshot.value = String(data.snapshots[0]?.snapshot.id ?? '')
		const binary = await $fetch<{ ghost: string }>(`/api/admin/ghost-validation/records/${recordId}/ghost`)
		const bytes = Uint8Array.fromBase64(binary.ghost)
		const ghost = await parseGhostInWorker(bytes.buffer as ArrayBuffer)
		if (!active) return
		review.value = data
		selectedSnapshot.value = String(data.snapshots[0]?.snapshot.id ?? '')
		ghosts.value = [{ ghost, record: { recordId, levelId: data.record.levelId, userId: 0, userSteamId: data.record.steamId, userName: ghost.metadata.taggedUsername, time: data.record.time, dateCreated: '', ghostUrl: null, mediaRevision: null, isWorldRecord: false, isPersonalBest: false }, identity: { recordId, userKey: data.record.steamId, playerName: ghost.metadata.taggedUsername ?? data.record.steamId, label: `Record ${recordId}`, isWorldRecord: false, isPersonalBest: false, userRunOrdinal: null, bodyColor: '#facc15', colorSource: 'fallback' } }]
	} catch (e) { if (active) error.value = e instanceof Error ? e.message : 'Evidence unavailable' }
}, { immediate: true })
watch(selectedSnapshot, () => { comparison.value = null })
async function compare() {
    const recordId = props.recordId
    const candidate = selectedSnapshot.value
    comparing.value = true; error.value = ''
    try {
        const result = await $fetch<{ report: ValidationReport }>(`/api/admin/ghost-validation/records/${recordId}/compare`, { method: 'POST', body: { idLevel: Number(candidate) } })
        if (recordId === props.recordId && candidate === selectedSnapshot.value) comparison.value = result.report
    } catch (e) {
        if (recordId === props.recordId && candidate === selectedSnapshot.value) error.value = e instanceof Error ? e.message : 'Comparison unavailable'
    } finally { comparing.value = false }
}
</script>

<template>
	<UCard class="rounded-xl border-border bg-card/85" aria-label="Candidate version comparison">
		<template #header><h2 class="font-semibold">Candidate version comparison</h2></template>
		<div class="space-y-4">
		<UAlert v-if="error" color="error" variant="soft" title="Evidence unavailable" :description="error" />
		<UFormField label="Candidate level version">
			<USelect v-model="selectedSnapshot" :items="snapshotItems" placeholder="Select a level version" :disabled="!snapshotItems.length" class="w-full" />
		</UFormField>
		<UButton :loading="comparing" :disabled="!selectedSnapshot" @click="compare">Compare selected version</UButton>
        <UAlert v-if="comparison" :color="comparison.status === 'fail' ? 'error' : comparison.status === 'pass' ? 'success' : 'warning'" variant="soft" :title="comparison.status" :description="comparison.reasons.join(', ') || 'Compatible with selected geometry'" />
        <div class="flex flex-wrap gap-2">
			<UBadge color="error" variant="soft">Missing checkpoint group</UBadge>
			<UBadge color="success" variant="soft">Compatible contact</UBadge>
			<UBadge color="info" variant="soft">Finish</UBadge>
			<UBadge color="neutral" variant="soft">Unverified</UBadge>
		</div>
		<p class="text-sm text-muted">Candidate matches do not establish original version.</p>
		<GhostPlaybackViewer v-if="review" :key="`${recordId}:${selectedSnapshot}`" :ghosts="ghosts" :level-id="review.record.levelId" :level-blocks="blocks" :level-asset-url="assetUrl" :show-level-geometry="performance.preferences.value.showLevelGeometry" :paint-mode="performance.preferences.value.paintMode" :show-ghost-trails="performance.preferences.value.showGhostTrails" :validation-overlays="overlays" v-model:current-time="time" v-model:playing="playing" v-model:following="following" :playback-rate="1" :loop="false" :selected-record-id="recordId" camera-mode="orbit" :frame-rate="performance.frameRate.value" :quality="performance.renderQuality.value" :labels="labels" />
		<div class="flex items-center gap-4">
			<UButton :disabled="!ghosts.length" @click="playing = !playing">{{ playing ? 'Pause' : 'Play' }}</UButton>
			<USlider v-model="time" :min="0" :max="Math.max(review?.record.time ?? 0, 0.01)" :step="0.01" :disabled="!ghosts.length" class="flex-1" aria-label="Ghost time" />
			<GhostPerformanceSettings
				:preferences="performance.preferences.value"
				:cache-stats="performance.cacheStats.value"
				:cache-pending="performance.cachePending.value"
				:labels="performanceLabels"
				@update:frame-rate="performance.setFrameRate"
				@update:render-quality="performance.setRenderQuality"
				@update:paint-mode="performance.setPaintMode"
				@update:show-level-geometry="performance.setShowLevelGeometry"
				@update:show-ghost-trails="performance.setShowGhostTrails"
				@clear-cache="performance.clearCache"
			/>
		</div>
		<p v-if="selectedReport" class="text-sm text-muted">{{ selectedReport.status }}: {{ selectedReport.reasons.join(', ') }}</p>
		</div>
	</UCard>
</template>
