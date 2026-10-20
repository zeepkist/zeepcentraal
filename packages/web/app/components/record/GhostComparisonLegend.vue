<template>
	<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
		<button
			v-for="ghost in ghosts"
			:key="ghost.record.recordId"
			type="button"
			class="group flex min-w-0 items-center gap-3 rounded-xl border bg-card/60 p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			:class="ghost.record.recordId === selectedRecordId ? 'border-primary/50 bg-primary/10' : 'border-border'"
			:aria-pressed="ghost.record.recordId === selectedRecordId"
			@click="$emit('select', ghost.record.recordId)"
		>
			<span
				class="size-3 shrink-0 rounded-full ring-2 ring-default"
				:style="{ backgroundColor: ghost.identity.bodyColor }"
			/>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-sm font-bold text-highlighted">{{ ghost.identity.label }}</span>
				<span class="block text-xs tabular-nums text-muted">{{ formatTime(ghost.record.time) }}</span>
			</span>
			<TablerIcon
				v-if="ghost.record.recordId === selectedRecordId"
				name="focus-centered"
				class="size-4 shrink-0 text-primary"
			/>
		</button>
	</div>
</template>

<script setup lang="ts">
import type { LoadedPlaybackGhost } from '~/types/ghost'

defineProps<{
	ghosts: LoadedPlaybackGhost[]
	selectedRecordId: number | null
}>()

defineEmits<{ select: [recordId: number] }>()

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
