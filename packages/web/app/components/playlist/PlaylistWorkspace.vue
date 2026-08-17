<script setup vapor lang="ts">
const store = usePlaylistsStore()
const { activePlaylist, hydrated } = storeToRefs(store)
const mobilePane = shallowRef<'playlist' | 'browser'>('playlist')
</script>

<template>
	<div class="space-y-6">
		<PlaylistLibraryToolbar v-if="hydrated" />
		<UCard v-else class="border-border bg-card/85">
			<div class="flex min-h-24 items-center justify-center gap-3 text-muted-foreground">
				<UIcon name="i-tabler-loader-2" class="size-5 animate-spin" />
				<span>{{ $t('playlist.persistence.loading') }}</span>
			</div>
		</UCard>
		<div v-if="hydrated" class="grid grid-cols-2 gap-2 lg:hidden">
			<UButton
				:variant="mobilePane === 'playlist' ? 'solid' : 'soft'"
				icon="i-tabler-layout-list"
				block
				@click="mobilePane = 'playlist'"
			>
				{{ $t('playlist.tabs.playlist') }}
			</UButton>
			<UButton
				:variant="mobilePane === 'browser' ? 'solid' : 'soft'"
				icon="i-tabler-search"
				block
				@click="mobilePane = 'browser'"
			>
				{{ $t('playlist.tabs.browser') }}
			</UButton>
		</div>
		<div
			v-if="hydrated"
			class="grid min-w-0 gap-6 lg:grid-cols-[minmax(21rem,25rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(30rem,30rem)_minmax(0,1fr)]"
		>
			<div :class="{ 'hidden lg:block': mobilePane !== 'playlist' }" class="min-w-0 space-y-6">
				<template v-if="activePlaylist">
					<PlaylistSettingsForm :playlist="activePlaylist" />
					<PlaylistLevelList />
				</template>
				<UCard v-else class="border-dashed border-border bg-card/65">
					<div class="grid min-h-72 place-items-center text-center">
						<div>
							<UIcon name="i-tabler-playlist" class="mx-auto size-12 text-muted-foreground" />
							<h2 class="mt-4 text-xl font-bold text-highlighted">{{ $t('playlist.empty.title') }}</h2>
							<p class="mt-1 text-muted-foreground">{{ $t('playlist.empty.description') }}</p>
							<UButton class="mt-5" icon="i-tabler-plus" @click="store.createPlaylist()">
								{{ $t('playlist.actions.new') }}
							</UButton>
						</div>
					</div>
				</UCard>
			</div>
			<div :class="{ 'hidden lg:block': mobilePane !== 'browser' }" class="min-w-0">
				<PlaylistLevelBrowser />
			</div>
		</div>
	</div>
</template>
