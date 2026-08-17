<script setup vapor lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { LocalPlaylistLevel } from '~/types/app'

const store = usePlaylistsStore()
const toast = useToast()
const { t } = useI18n()
const list = useTemplateRef<HTMLElement>('list')
const levels = computed<LocalPlaylistLevel[]>({
	get: () => store.activePlaylist?.levels ?? [],
	set: (value) => store.setLevelOrder(value),
})

useSortable(list, levels, {
	handle: '.playlist-drag-handle',
	animation: 150,
	watchElement: true,
})

function remove(uid: string) {
	const removed = store.removeLevel(uid)
	if (!removed) return
	toast.add({
		title: t('playlist.toasts.removed', { level: removed.level.Name }),
		actions: [
			{
				label: t('playlist.actions.undo'),
				onClick: () => store.addStoredLevel(removed.level, removed.index),
			},
		],
	})
}
</script>

<template>
	<UCard class="border-border bg-card/85">
		<template #header>
			<div class="flex items-center justify-between gap-3">
				<h2 class="font-semibold text-highlighted">{{ $t('playlist.levels.title') }}</h2>
				<UBadge color="neutral" variant="soft">
					{{ $t('playlist.levels.count', { count: levels.length }) }}
				</UBadge>
			</div>
		</template>
		<div
			v-if="levels.length === 0"
			class="grid min-h-48 place-items-center rounded-xl border border-dashed border-border text-center"
		>
			<div>
				<UIcon name="i-tabler-playlist" class="mx-auto size-9 text-muted-foreground" />
				<p class="mt-3 font-medium text-highlighted">{{ $t('playlist.levels.emptyTitle') }}</p>
				<p class="text-sm text-muted-foreground">{{ $t('playlist.levels.emptyDescription') }}</p>
			</div>
		</div>
		<ul v-else ref="list" class="grid gap-2">
			<PlaylistLevelRow
				v-for="(level, index) in levels"
				:key="level.UID"
				:level="level"
				:index="index"
				:total="levels.length"
				@move="store.moveLevel"
				@remove="remove"
			/>
		</ul>
	</UCard>
</template>
