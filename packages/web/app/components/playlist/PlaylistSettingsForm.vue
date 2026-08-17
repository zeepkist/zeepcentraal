<script setup vapor lang="ts">
import type { LocalPlaylist } from '~/types/app'
import {
	PLAYLIST_MAX_ROUND_LENGTH,
	PLAYLIST_MIN_ROUND_LENGTH,
	PLAYLIST_ROUND_LENGTH_STEP,
} from '~/utils/playlist'

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
	<UCard class="border-border bg-card/85">
		<template #header>
			<h2 class="font-semibold text-highlighted">{{ $t('playlist.settings.title') }}</h2>
		</template>
		<div class="grid gap-5">
			<UFormField :label="$t('playlist.settings.name')">
				<UInput :model-value="playlist.name" class="w-full" @change="rename" />
			</UFormField>
			<UFormField
				:label="$t('playlist.settings.roundLength')"
				:hint="$t('playlist.settings.roundLengthHint')"
			>
				<UInputNumber
					:model-value="playlist.roundLength"
					:min="PLAYLIST_MIN_ROUND_LENGTH"
					:max="PLAYLIST_MAX_ROUND_LENGTH"
					:step="PLAYLIST_ROUND_LENGTH_STEP"
					class="w-full"
					@update:model-value="setRoundLength"
				/>
			</UFormField>
			<div
				class="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/35 p-4"
			>
				<div>
					<p class="font-medium text-highlighted">{{ $t('playlist.settings.shuffle') }}</p>
					<p class="text-sm text-muted-foreground">{{ $t('playlist.settings.shuffleHint') }}</p>
				</div>
				<USwitch
					:model-value="playlist.shufflePlaylist"
					:aria-label="$t('playlist.settings.shuffle')"
					@update:model-value="store.setShuffle(playlist.id, $event)"
				/>
			</div>
			<p class="text-sm text-muted-foreground">
				{{ $t('playlist.settings.estimatedDuration', { duration: estimatedDuration }) }}
			</p>
		</div>
	</UCard>
</template>
