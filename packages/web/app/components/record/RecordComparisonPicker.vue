<template>
	<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
		<div class="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
			<div class="grid gap-5 sm:grid-cols-2">
				<div>
					<p class="font-semibold text-highlighted">{{ labels.quickComparisons }}</p>
					<p class="mt-1 text-sm text-muted">{{ labels.quickDescription }}</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<UButton v-if="worldRecord?.ghostUrl" color="primary" variant="soft" icon="i-tabler-trophy" @click="$emit('toggle', worldRecord.recordId)">
							{{ labels.worldRecord }}
						</UButton>
						<UButton v-if="viewerPersonalBest?.ghostUrl" color="neutral" variant="soft" icon="i-tabler-user-star" @click="$emit('toggle', viewerPersonalBest.recordId)">
							{{ labels.myPersonalBest }}
						</UButton>
					</div>
				</div>
				<div>
					<p class="font-semibold text-highlighted">{{ labels.presets }}</p>
					<p class="mt-1 text-sm text-muted">{{ labels.presetsDescription }}</p>
					<div class="mt-3 flex flex-wrap gap-2">
						<UButton v-for="count in presetCounts" :key="`top-${count}`" color="neutral" variant="soft" @click="$emit('selectTop', count)">
							{{ labels.topPlayers(count) }}
						</UButton>
						<UButton v-for="count in presetCounts" :key="`owner-${count}`" color="neutral" variant="soft" @click="$emit('selectOwner', count)">
							{{ labels.ownerRuns(count) }}
						</UButton>
					</div>
				</div>
			</div>

			<div class="mt-5 border-t border-border pt-5">
				<UFormField :label="labels.searchLabel">
					<UInput
						:model-value="search"
						class="mt-2 w-full"
						icon="i-tabler-search"
						:placeholder="labels.searchPlaceholder"
						@update:model-value="$emit('update:search', String($event))"
					/>
				</UFormField>
				<div v-if="searchPending" class="mt-3 flex items-center gap-2 text-sm text-muted">
					<TablerIcon name="loader-2" class="size-4 animate-spin motion-reduce:animate-none" /> {{ labels.searching }}
				</div>
				<div v-else-if="users.length" class="mt-3 grid gap-2 sm:grid-cols-2">
					<button
						v-for="user in users"
						:key="user.id"
						type="button"
						class="flex items-center justify-between gap-3 rounded-xl border border-border bg-default/50 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
						:disabled="!user.personalBest?.ghostUrl"
						@click="user.personalBest?.ghostUrl && $emit('toggle', user.personalBest.recordId)"
					>
						<span class="truncate font-semibold text-highlighted">{{ user.name }}</span>
						<span class="shrink-0 text-xs text-muted">{{ user.personalBest ? formatTime(user.personalBest.time) : labels.noPersonalBest }}</span>
					</button>
				</div>
			</div>
		</div>

		<div class="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="font-semibold text-highlighted">{{ labels.selected }}</p>
					<p class="mt-1 text-sm text-muted">{{ labels.selectedCount(selected.length) }}</p>
				</div>
				<UButton v-if="selected.length" color="neutral" variant="ghost" size="sm" @click="$emit('clear')">{{ labels.clear }}</UButton>
			</div>
			<div v-if="selected.length" class="mt-4 space-y-2">
				<div v-for="record in selected" :key="record.recordId" class="flex items-center gap-3 rounded-xl border border-border bg-default/55 p-3">
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold text-highlighted">{{ record.userName ?? labels.unknownPlayer }}</p>
						<p class="text-xs tabular-nums text-muted">{{ formatTime(record.time) }}</p>
					</div>
					<UButton color="neutral" variant="ghost" size="xs" icon="i-tabler-x" :aria-label="labels.remove" @click="$emit('toggle', record.recordId)" />
				</div>
			</div>
			<p v-else class="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted">{{ labels.noneSelected }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { GhostRecordSource } from '~/types/ghost'
import type { RecordComparisonUser } from '~/types/recordDetail'

defineProps<{
	worldRecord?: GhostRecordSource | null
	viewerPersonalBest?: GhostRecordSource | null
	selected: GhostRecordSource[]
	users: RecordComparisonUser[]
	search: string
	searchPending: boolean
	labels: {
		quickComparisons: string
		quickDescription: string
		worldRecord: string
		myPersonalBest: string
		presets: string
		presetsDescription: string
		topPlayers: (count: number) => string
		ownerRuns: (count: number) => string
		searchLabel: string
		searchPlaceholder: string
		searching: string
		noPersonalBest: string
		selected: string
		selectedCount: (count: number) => string
		clear: string
		remove: string
		noneSelected: string
		unknownPlayer: string
	}
}>()

defineEmits<{
	'update:search': [value: string]
	toggle: [recordId: number]
	selectTop: [count: number]
	selectOwner: [count: number]
	clear: []
}>()

const presetCounts = [3, 5, 10] as const

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
