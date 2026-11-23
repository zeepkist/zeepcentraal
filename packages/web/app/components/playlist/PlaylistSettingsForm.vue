<script setup lang="ts">

import type { LocalPlaylist } from '~/types/app'
import {
	PLAYLIST_MAX_ROUND_LENGTH,
	PLAYLIST_MIN_ROUND_LENGTH,
	PLAYLIST_ROUND_LENGTH_STEP,
} from '~/utils/playlist'

const { t } = useAppI18n()

const props = defineProps<{ playlist: LocalPlaylist }>()
const store = usePlaylistsStore()
const estimatedDuration = computed(() => {
	const seconds = props.playlist.roundLength * props.playlist.levels.length
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.ceil((seconds % 3600) / 60)
	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})

function rename(event: Event) {
	store.renamePlaylist(props.playlist.id, (event.target as HTMLInputElement).value)
}

function setRoundLength(value: number | undefined) {
	if (value !== undefined) store.setRoundLength(props.playlist.id, value)
}
</script>

<template>
	<UCard class="min-w-0 border-border bg-card/85" :ui="{ body: 'p-3 sm:p-6' }">
		<template #header>
			<h2 class="font-semibold text-highlighted">{{ t('playlist.settings.title') }}</h2>
		</template>
		<div class="grid min-w-0 gap-5">
			<UFormField :label="t('playlist.settings.name')">
				<UInput :model-value="playlist.name" class="w-full" :ui="{ base: 'min-h-11' }" @change="rename" />
			</UFormField>
			<UFormField
				:label="t('playlist.settings.roundLength')"
				:hint="t('playlist.settings.roundLengthHint')"
				:ui="{ labelWrapper: 'flex-wrap gap-x-2 gap-y-1', hint: 'min-w-0 wrap-anywhere' }"
			>
				<UInputNumber
					:model-value="playlist.roundLength"
					:min="PLAYLIST_MIN_ROUND_LENGTH"
					:max="PLAYLIST_MAX_ROUND_LENGTH"
					:step="PLAYLIST_ROUND_LENGTH_STEP"
					class="w-full"
					:ui="{ base: 'min-h-11' }"
					@update:model-value="setRoundLength"
				/>
			</UFormField>
			<div
				class="rounded-xl border border-border bg-muted/35 p-3"
			>
				<USwitch
					:model-value="playlist.shufflePlaylist"
					:label="t('playlist.settings.shuffle')"
					:description="t('playlist.settings.shuffleHint')"
					:ui="{ root: 'min-h-11 items-center', container: 'shrink-0', wrapper: 'min-w-0 wrap-anywhere' }"
					@update:model-value="store.setShuffle(playlist.id, $event)"
				/>
			</div>
			<p class="text-sm text-muted-foreground">
				{{ t('playlist.settings.estimatedDuration', { duration: estimatedDuration }) }}
			</p>
		</div>
	</UCard>
</template>
