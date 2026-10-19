<script setup vapor lang="ts">
import { useMediaQuery, usePreferredReducedMotion } from '@vueuse/core'
import { cssTimeToMilliseconds } from '~/utils/motion'

const { t } = useAppI18n()

const store = usePlaylistsStore()
const { activePlaylist, hydrated } = storeToRefs(store)
const mobilePane = shallowRef<'playlist' | 'browser'>('playlist')
const playlistPane = useTemplateRef<HTMLElement>('playlistPane')
const browserPane = useTemplateRef<HTMLElement>('browserPane')
const desktop = useMediaQuery('(min-width: 1024px)')
const preferredMotion = usePreferredReducedMotion()
let reveal: Animation | undefined
let generation = 0

function canReveal() {
	return !desktop.value && preferredMotion.value !== 'reduce'
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

watch([desktop, preferredMotion], cancelReveal, { flush: 'sync' })
onScopeDispose(cancelReveal)
</script>

<template>
	<div class="space-y-6">
		<UCard v-if="!hydrated" class="border-border bg-card/85">
			<div class="flex min-h-24 items-center justify-center gap-3 text-muted-foreground">
				<UIcon name="i-tabler-loader-2" class="size-5 animate-spin" />
				<span>{{ t('playlist.persistence.loading') }}</span>
			</div>
		</UCard>
		<div v-if="hydrated" class="grid grid-cols-2 gap-2 lg:hidden">
			<UButton
				:variant="mobilePane === 'playlist' ? 'solid' : 'soft'"
				icon="i-tabler-layout-list"
				block
				@click="selectPane('playlist', $event)"
			>
				{{ t('playlist.tabs.playlist') }}
			</UButton>
			<UButton
				:variant="mobilePane === 'browser' ? 'solid' : 'soft'"
				icon="i-tabler-search"
				block
				@click="selectPane('browser', $event)"
			>
				{{ t('playlist.tabs.browser') }}
			</UButton>
		</div>
		<div
			v-if="hydrated"
			class="grid min-w-0 gap-6 lg:grid-cols-[minmax(21rem,25rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(30rem,30rem)_minmax(0,1fr)]"
		>
			<div ref="playlistPane" data-testid="playlist-pane" :class="{ 'hidden lg:block': mobilePane !== 'playlist' }" class="min-w-0 space-y-6">
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
			<div ref="browserPane" data-testid="browser-pane" :class="{ 'hidden lg:block': mobilePane !== 'browser' }" class="min-w-0">
				<PlaylistLevelBrowser />
			</div>
		</div>
	</div>
</template>
