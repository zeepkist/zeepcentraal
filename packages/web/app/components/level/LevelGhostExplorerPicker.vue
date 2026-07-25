<template>
	<div class="space-y-5">
		<div class="grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
			<div class="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
				<p class="font-semibold text-highlighted">{{ labels.quickTitle }}</p>
				<p class="mt-1 text-sm text-muted">{{ labels.quickDescription }}</p>
				<div class="mt-4 flex flex-wrap gap-2">
					<UButton
						v-if="worldRecord?.ghostUrl"
						color="primary"
						variant="soft"
						icon="i-tabler-trophy"
						:disabled="individualLocked || selectedIds.has(worldRecord.recordId)"
						@click="$emit('add', worldRecord)"
					>
						{{ labels.worldRecord }}
					</UButton>
					<UButton
						v-if="viewerPersonalBest?.ghostUrl"
						color="neutral"
						variant="soft"
						icon="i-tabler-user-star"
						:disabled="individualLocked || selectedIds.has(viewerPersonalBest.recordId)"
						@click="$emit('add', viewerPersonalBest)"
					>
						{{ labels.viewerPersonalBest }}
					</UButton>
				</div>

				<div class="mt-5 border-t border-border pt-5">
					<p class="font-semibold text-highlighted">{{ labels.searchTitle }}</p>
					<p class="mt-1 text-sm text-muted">{{ labels.searchDescription }}</p>
					<UFormField :label="labels.searchLabel" class="mt-4">
						<UInput
							:model-value="search"
							class="w-full"
							icon="i-tabler-search"
							:placeholder="labels.searchPlaceholder"
							:disabled="individualLocked"
							@update:model-value="$emit('update:search', String($event))"
						/>
					</UFormField>
					<div v-if="searchPending" class="mt-3 flex items-center gap-2 text-sm text-muted">
						<TablerIcon name="loader-2" class="size-4 animate-spin motion-reduce:animate-none" />
						{{ labels.searching }}
					</div>
					<div v-else-if="users.length" class="mt-3 grid gap-2 sm:grid-cols-2">
						<button
							v-for="candidate in users"
							:key="candidate.id"
							type="button"
							class="flex items-center justify-between gap-3 rounded-xl border border-border bg-default/50 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
							:disabled="individualLocked || selectedIds.has(candidate.personalBest.recordId)"
							@click="$emit('add', candidate.personalBest)"
						>
							<span class="truncate font-semibold text-highlighted">{{ candidate.name }}</span>
							<span class="shrink-0 text-xs tabular-nums text-muted">
								{{ formatTime(candidate.personalBest.time) }}
							</span>
						</button>
					</div>
				</div>
			</div>

			<div class="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
				<p class="font-semibold text-highlighted">{{ labels.presetsTitle }}</p>
				<p class="mt-1 text-sm text-muted">{{ labels.presetsDescription }}</p>
				<div class="mt-4 grid gap-3">
					<div
						v-for="preset in presets"
						:key="preset.kind"
						class="grid gap-3 rounded-xl border border-border bg-default/50 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center"
					>
						<div class="min-w-0">
							<p class="font-semibold text-highlighted">{{ preset.label }}</p>
							<p class="mt-0.5 text-xs text-muted">{{ preset.description }}</p>
						</div>
						<USelect
							:model-value="presetCounts[preset.kind]"
							:items="countOptions"
							:aria-label="labels.countLabel"
							class="w-full"
							@update:model-value="setPresetCount(preset.kind, $event)"
						/>
						<UButton
							color="neutral"
							variant="soft"
							icon="i-tabler-player-play"
							:loading="presetPending === preset.kind"
							:disabled="presetPending !== null"
							@click="$emit('loadPreset', preset.kind, presetCounts[preset.kind])"
						>
							{{ presetPending === preset.kind ? labels.loadingPreset : labels.loadPreset }}
						</UButton>
					</div>
				</div>
			</div>
		</div>

		<div class="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p class="font-semibold text-highlighted">{{ labels.activeTitle }}</p>
					<p class="mt-1 text-sm text-muted">{{ labels.activeCount(selected.length) }}</p>
					<p v-if="selected.length" class="mt-1 text-xs text-muted">
						{{ labels.progress(loadedCount, loadingCount, failedCount) }}
					</p>
				</div>
				<UButton
					v-if="selected.length"
					color="neutral"
					variant="ghost"
					icon="i-tabler-trash"
					@click="$emit('clear')"
				>
					{{ labels.clearAll }}
				</UButton>
			</div>

			<UAlert
				v-if="bulkLocked"
				class="mt-4"
				color="warning"
				variant="subtle"
				icon="i-tabler-stack-2"
				:title="labels.bulkTitle"
				:description="labels.bulkDescription"
			/>
			<p v-if="selected.length > followLimit" class="mt-3 text-xs text-muted">
				{{ labels.followLimit }}
			</p>

			<div v-if="selected.length && !bulkLocked" class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
				<div
					v-for="record in selected"
					:key="record.recordId"
					class="flex items-center gap-3 rounded-xl border border-border bg-default/55 p-3"
				>
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold text-highlighted">
							{{ record.userName ?? labels.unknownPlayer }}
						</p>
						<p class="text-xs tabular-nums text-muted">{{ formatTime(record.time) }}</p>
					</div>
					<UButton
						color="neutral"
						variant="ghost"
						size="xs"
						icon="i-tabler-x"
						:aria-label="labels.remove"
						@click="$emit('remove', record.recordId)"
					/>
				</div>
			</div>
			<p v-else-if="!selected.length" class="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
				{{ labels.noneSelected }}
			</p>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import type { GhostRecordSource } from '~/types/ghost'
import {
	LEVEL_GHOST_PRESET_COUNTS,
	type LevelGhostPresetCount,
	type LevelGhostPresetKind,
	type LevelGhostSearchUser,
} from '~/types/levelGhostExplorer'

const props = defineProps<{
	worldRecord?: GhostRecordSource | null
	viewerPersonalBest?: GhostRecordSource | null
	selected: GhostRecordSource[]
	users: LevelGhostSearchUser[]
	search: string
	searchPending: boolean
	presetPending: LevelGhostPresetKind | null
	loadedCount: number
	loadingCount: number
	failedCount: number
	bulkLocked: boolean
	followLimit: number
	presets: Array<{
		kind: LevelGhostPresetKind
		label: string
		description: string
	}>
	labels: {
		quickTitle: string
		quickDescription: string
		worldRecord: string
		viewerPersonalBest: string
		presetsTitle: string
		presetsDescription: string
		countLabel: string
		loadPreset: string
		loadingPreset: string
		searchTitle: string
		searchDescription: string
		searchLabel: string
		searchPlaceholder: string
		searching: string
		activeTitle: string
		activeCount: (count: number) => string
		progress: (loaded: number, loading: number, failed: number) => string
		noneSelected: string
		clearAll: string
		remove: string
		bulkTitle: string
		bulkDescription: string
		followLimit: string
		unknownPlayer: string
	}
}>()

defineEmits<{
	'update:search': [value: string]
	add: [source: GhostRecordSource]
	remove: [recordId: number]
	loadPreset: [kind: LevelGhostPresetKind, count: LevelGhostPresetCount]
	clear: []
}>()

const presetCounts = reactive<Record<LevelGhostPresetKind, LevelGhostPresetCount>>({
	'personal-bests': 10,
	'global-records': 10,
	'viewer-records': 10,
})
const countOptions = LEVEL_GHOST_PRESET_COUNTS.map((count) => ({ label: String(count), value: count }))
const selectedIds = computed(() => new Set(props.selected.map(({ recordId }) => recordId)))
const individualLocked = computed(() => props.bulkLocked || props.selected.length >= 10)

function setPresetCount(kind: LevelGhostPresetKind, value: unknown) {
	const count = Number(value)
	if (LEVEL_GHOST_PRESET_COUNTS.includes(count as LevelGhostPresetCount)) {
		presetCounts[kind] = count as LevelGhostPresetCount
	}
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
