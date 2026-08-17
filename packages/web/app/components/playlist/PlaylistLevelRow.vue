<script setup vapor lang="ts">
import type { LocalPlaylistLevel } from '~/types/app'

defineProps<{ level: LocalPlaylistLevel; index: number; total: number }>()
defineEmits<{ move: [from: number, to: number]; remove: [uid: string] }>()
</script>

<template>
	<li
		class="flex items-center gap-3 rounded-xl border border-border bg-card/75 p-3"
		:data-uid="level.UID"
	>
		<button
			class="playlist-drag-handle cursor-grab touch-none text-muted-foreground hover:text-highlighted"
			type="button"
			:aria-label="$t('playlist.levels.drag')"
		>
			<UIcon name="i-tabler-grip-vertical" class="size-5" />
		</button>
		<NuxtLink
			v-if="level.xxHash"
			:to="`/level/${level.xxHash}`"
			class="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
		>
			<NuxtImg
				v-if="level.imageUrl"
				:src="level.imageUrl"
				:alt="level.Name"
				width="160"
				height="90"
				class="h-14 w-24 rounded-lg object-cover"
				loading="lazy"
			/>
			<div v-else class="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-muted">
				<UIcon name="i-tabler-photo-off" />
			</div>
			<div class="min-w-0">
				<p class="truncate font-semibold text-highlighted">{{ level.Name }}</p>
				<p class="truncate text-sm text-muted-foreground">{{ level.Author }}</p>
			</div>
		</NuxtLink>
		<div v-else class="min-w-0 flex-1">
			<p class="truncate font-semibold text-highlighted">{{ level.Name }}</p>
			<p class="truncate text-sm text-muted-foreground">{{ level.Author }}</p>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<UButton
				icon="i-tabler-arrow-up"
				color="neutral"
				variant="ghost"
				square
				:disabled="index === 0"
				:aria-label="$t('playlist.levels.moveUp')"
				@click="$emit('move', index, index - 1)"
			/>
			<UButton
				icon="i-tabler-arrow-down"
				color="neutral"
				variant="ghost"
				square
				:disabled="index === total - 1"
				:aria-label="$t('playlist.levels.moveDown')"
				@click="$emit('move', index, index + 1)"
			/>
			<UButton
				icon="i-tabler-trash"
				color="error"
				variant="ghost"
				square
				:aria-label="$t('playlist.levels.remove')"
				@click="$emit('remove', level.UID)"
			/>
		</div>
	</li>
</template>
