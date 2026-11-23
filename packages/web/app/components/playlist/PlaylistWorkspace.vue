<script setup lang="ts">
import { useMediaQuery, usePreferredReducedMotion } from '@vueuse/core'
import { cssTimeToMilliseconds } from '~/utils/motion'

const { t } = useAppI18n()

const store = usePlaylistsStore()
const { activePlaylist, hydrated } = storeToRefs(store)
const mobilePane = shallowRef<'playlist' | 'browser'>('playlist')
const playlistPane = useTemplateRef<HTMLElement>('playlistPane')
const browserPane = useTemplateRef<HTMLElement>('browserPane')
const splitView = useMediaQuery('(min-width: 1280px) and (min-height: 576px)')
const preferredMotion = usePreferredReducedMotion()
let reveal: Animation | undefined
let generation = 0

function canReveal() {
	return !splitView.value && preferredMotion.value !== 'reduce'
}

function cancelReveal() {
	generation++
	reveal?.cancel()
	reveal = undefined
}

async function selectPane(pane: 'playlist' | 'browser', event: MouseEvent) {
	if (mobilePane.value === pane) return
	cancelReveal()
	if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
	mobilePane.value = pane
	if (event.detail === 0 || !canReveal()) return
	const pendingGeneration = generation
	await nextTick()
	if (pendingGeneration !== generation || !canReveal()) return
	const element = pane === 'playlist' ? playlistPane.value : browserPane.value
	if (!element?.animate) return
	const style = getComputedStyle(element)
	reveal = element.animate([{ opacity: 0 }, { opacity: 1 }], {
		duration: cssTimeToMilliseconds(style.getPropertyValue('--duration-feedback')),
		easing: style.getPropertyValue('--ease-out').trim(),
	})
}

watch([splitView, preferredMotion], cancelReveal, { flush: 'sync' })
onScopeDispose(cancelReveal)
</script>

<template>
	<div class="playlist-workspace min-w-0 space-y-6">
		<UCard v-if="!hydrated" class="border-border bg-card/85">
			<div class="flex min-h-24 items-center justify-center gap-3 text-muted-foreground">
				<UIcon name="i-tabler-loader-2" class="size-5 animate-spin" />
				<span>{{ t('playlist.persistence.loading') }}</span>
			</div>
		</UCard>
		<div v-if="hydrated" class="playlist-pane-controls grid grid-cols-2 gap-2">
			<UButton
				:variant="mobilePane === 'playlist' ? 'solid' : 'soft'"
				icon="i-tabler-layout-list"
				class="min-h-11 min-w-0 text-center wrap-anywhere"
				:aria-pressed="mobilePane === 'playlist'"
				aria-controls="playlist-editor-pane"
				block
				@click="selectPane('playlist', $event)"
			>
				{{ t('playlist.tabs.playlist') }}
			</UButton>
			<UButton
				:variant="mobilePane === 'browser' ? 'solid' : 'soft'"
				icon="i-tabler-search"
				class="min-h-11 min-w-0 text-center wrap-anywhere"
				:aria-pressed="mobilePane === 'browser'"
				aria-controls="playlist-browser-pane"
				block
				@click="selectPane('browser', $event)"
			>
				{{ t('playlist.tabs.browser') }}
			</UButton>
		</div>
		<div v-if="hydrated" class="playlist-panes grid min-w-0 gap-6">
			<div
				id="playlist-editor-pane"
				ref="playlistPane"
				data-testid="playlist-pane"
				:class="{ 'playlist-pane-inactive': mobilePane !== 'playlist' }"
				class="min-w-0 space-y-6"
			>
				<PlaylistLibraryToolbar />
				<template v-if="activePlaylist">
					<PlaylistSettingsForm :playlist="activePlaylist" />
					<PlaylistLevelList />
				</template>
				<UCard v-else class="border-dashed border-border bg-card/65">
					<div class="grid min-h-72 place-items-center text-center">
						<div>
							<UIcon name="i-tabler-playlist" class="mx-auto size-12 text-muted-foreground" />
							<h2 class="mt-4 text-xl font-bold text-highlighted">{{ t('playlist.empty.title') }}</h2>
							<p class="mt-1 text-muted-foreground">{{ t('playlist.empty.description') }}</p>
							<UButton class="mt-5" icon="i-tabler-plus" @click="store.createPlaylist()">
								{{ t('playlist.actions.new') }}
							</UButton>
						</div>
					</div>
				</UCard>
			</div>
			<div
				id="playlist-browser-pane"
				ref="browserPane"
				data-testid="browser-pane"
				:class="{ 'playlist-pane-inactive': mobilePane !== 'browser' }"
				class="min-w-0"
			>
				<PlaylistLevelBrowser />
			</div>
		</div>
	</div>
</template>

<style scoped>
.playlist-pane-inactive {
	display: none;
}

/* Keep in sync with splitView so pane reveals cancel on entering split view. */
@media (min-width: 1280px) and (min-height: 576px) {
	.playlist-pane-controls {
		display: none;
	}

	.playlist-panes {
		grid-template-columns: clamp(21rem, 32%, 30rem) minmax(0, 1fr);
	}

	.playlist-pane-inactive {
		display: block;
	}
}

@media (any-pointer: coarse) {
	.playlist-workspace :deep(input),
	.playlist-workspace :deep([role="combobox"]) {
		font-size: 1rem;
		min-height: 2.75rem;
	}
}
</style>
