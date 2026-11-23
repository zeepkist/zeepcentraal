<script setup lang="ts">

import type { LocalPlaylistLevel } from '~/types/app'

const { t } = useAppI18n()

defineProps<{ level: LocalPlaylistLevel; index: number; total: number }>()
defineEmits<{ move: [from: number, to: number]; remove: [uid: string] }>()
</script>

<template>
	<li
		class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border bg-card/75 p-2 @min-[24rem]/playlist-list:grid-cols-[auto_minmax(0,1fr)_auto]"
		:data-uid="level.UID"
	>
		<span
			class="playlist-drag-handle grid size-11 cursor-grab touch-none select-none place-items-center rounded-lg text-muted-foreground hover:text-highlighted active:cursor-grabbing"
			aria-hidden="true"
			:title="t('playlist.levels.drag')"
		>
			<UIcon name="i-tabler-grip-vertical" class="size-5" />
		</span>
		<NuxtLink
			v-if="level.xxHash"
			:to="`/level/${level.xxHash}`"
			class="flex min-h-11 min-w-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
		>
			<NuxtImg
				v-if="level.imageUrl"
				:src="level.imageUrl"
				alt=""
				width="160"
				height="90"
				class="h-10 w-16 shrink-0 rounded-lg object-cover"
				loading="lazy"
			/>
			<div v-else class="grid h-10 w-16 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden="true">
				<UIcon name="i-tabler-photo-off" />
			</div>
			<div class="min-w-0">
				<p class="line-clamp-2 font-semibold wrap-anywhere text-highlighted">{{ level.Name }}</p>
				<p class="truncate text-sm text-muted-foreground">{{ level.Author }}</p>
			</div>
		</NuxtLink>
		<div v-else class="min-w-0">
			<p class="line-clamp-2 font-semibold wrap-anywhere text-highlighted">{{ level.Name }}</p>
			<p class="truncate text-sm text-muted-foreground">{{ level.Author }}</p>
		</div>
		<div class="col-span-full flex flex-wrap items-center justify-end gap-1 @min-[24rem]/playlist-list:col-span-1">
			<UButton
				icon="i-tabler-arrow-up"
				color="neutral"
				variant="ghost"
				class="size-11 touch-manipulation justify-center"
				square
				:disabled="index === 0"
				:aria-label="t('playlist.levels.moveUp')"
				@click="$emit('move', index, index - 1)"
			/>
			<UButton
				icon="i-tabler-arrow-down"
				color="neutral"
				variant="ghost"
				class="size-11 touch-manipulation justify-center"
				square
				:disabled="index === total - 1"
				:aria-label="t('playlist.levels.moveDown')"
				@click="$emit('move', index, index + 1)"
			/>
			<UButton
				icon="i-tabler-trash"
				color="error"
				variant="soft"
				class="size-11 touch-manipulation justify-center"
				square
				:aria-label="t('playlist.levels.remove')"
				@click="$emit('remove', level.UID)"
			/>
		</div>
	</li>
</template>
