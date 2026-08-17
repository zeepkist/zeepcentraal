<script setup vapor lang="ts">
import type { AddPlaylistLevelResult } from '~/stores/playlists'
import type { LevelSummary } from '~/types/app'
import { parseSafeWorkshopId } from '~/utils/playlist'

const props = defineProps<{ level: LevelSummary }>()
const store = usePlaylistsStore()
const toast = useToast()
const { t } = useI18n()
const added = computed(() => store.hasLevel(props.level.fileUid))
const canAdd = computed(
	() => Boolean(props.level.fileUid && parseSafeWorkshopId(props.level.workshopId) !== null),
)
const accessibleLabel = computed(() =>
	added.value ? t('playlist.actions.remove') : t('playlist.actions.add'),
)

function addFailureTitle(result: Exclude<AddPlaylistLevelResult, 'added'>) {
	if (result === 'duplicate') return t('playlist.toasts.duplicate')
	if (result === 'full') return t('playlist.toasts.full')
	return t('playlist.toasts.invalid')
}

function remove() {
	const removed = store.removeLevel(props.level.fileUid ?? '')
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

function toggle() {
	if (added.value) {
		remove()
		return
	}
	const result = store.addLevel(props.level)
	if (result === 'added') {
		toast.add({
			title: t('playlist.toasts.added', { level: props.level.name }),
			color: 'success',
			actions: [
				{
					label: t('playlist.actions.undo'),
					onClick: () => store.removeLevel(props.level.fileUid ?? ''),
				},
			],
		})
		return
	}
	toast.add({
		title: addFailureTitle(result),
		color: result === 'duplicate' ? 'warning' : 'error',
	})
}
</script>

<template>
	<UButton
		:color="added ? 'error' : 'primary'"
		variant="solid"
		:icon="added ? 'i-tabler-playlist-x' : 'i-tabler-playlist-add'"
		:disabled="!added && !canAdd"
		:aria-label="accessibleLabel"
		:title="accessibleLabel"
		@click.prevent.stop="toggle"
	>
		{{ added ? $t('playlist.actions.remove') : $t('playlist.actions.add') }}
	</UButton>
</template>
