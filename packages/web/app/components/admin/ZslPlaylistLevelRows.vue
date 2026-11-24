<script setup lang="ts">
import { steamWorkshopItemUrl } from '~/utils/steamWorkshop'
import type { ZslPlaylistLevel } from './zslTypes'
import { playlistLevelStates } from './zslTypes'

defineProps<{ levels: ZslPlaylistLevel[] }>()
</script>

<template>
	<ol class="space-y-2">
		<li
			v-for="level in levels"
			:key="`${level.position}:${level.workshopId}:${level.uid}`"
			class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-xl border border-default bg-elevated/35 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
		>
			<div class="relative grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted">
				<NuxtImg
					v-if="level.imageUrl"
					:src="level.imageUrl"
					alt=""
					width="160"
					height="90"
					loading="lazy"
					class="size-full object-cover"
				/>
				<UIcon v-else name="i-tabler-photo" class="size-5" aria-hidden="true" />
				<span class="absolute start-0.5 top-0.5 rounded bg-default/90 px-1 text-xs font-medium text-highlighted tabular-nums">
					<span class="sr-only">Position </span>{{ level.position }}
				</span>
			</div>
			<div class="min-w-0 space-y-1 text-sm">
				<NuxtLink
					v-if="level.xxHash"
					:to="`/level/${level.xxHash}`"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-block max-w-full rounded-sm font-semibold wrap-anywhere text-highlighted underline decoration-muted underline-offset-3 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					{{ level.name }}
					<UIcon name="i-tabler-external-link" class="ms-0.5 size-3.5 align-text-bottom" aria-hidden="true" />
					<span class="sr-only"> (opens in a new tab)</span>
				</NuxtLink>
				<p v-else class="font-semibold wrap-anywhere text-highlighted">{{ level.name }}</p>
				<div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-toned">
					<span>Workshop <span class="font-mono">{{ level.workshopId }}</span></span>
					<span class="min-w-0 wrap-anywhere">UID <span class="font-mono">{{ level.uid }}</span></span>
				</div>
				<p :class="level.state === 'failed' ? 'text-error' : 'text-muted'" class="wrap-anywhere">{{ level.stage }}</p>
				<NuxtLink
					v-if="!level.xxHash && steamWorkshopItemUrl(level.workshopId)"
					:to="steamWorkshopItemUrl(level.workshopId)"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-highlighted underline decoration-muted underline-offset-3 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					Steam Workshop
					<UIcon name="i-tabler-external-link" class="size-3.5" aria-hidden="true" />
					<span class="sr-only"> for {{ level.name }} (opens in a new tab)</span>
				</NuxtLink>
			</div>
			<UBadge
				:color="playlistLevelStates[level.state].color"
				:icon="playlistLevelStates[level.state].icon"
				variant="soft"
				class="col-start-2 justify-self-start sm:col-start-3 sm:row-start-1"
			>{{ playlistLevelStates[level.state].label }}</UBadge>
		</li>
	</ol>
</template>
