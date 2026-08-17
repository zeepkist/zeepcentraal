<script setup vapor lang="ts">
import type { PlaylistImportReport } from '~/types/app'
import {
	downloadPlaylist,
	importPlaylistText,
	isPlaylistDownloadable,
	PLAYLIST_MAX_FILE_SIZE,
} from '~/utils/playlist'

const store = usePlaylistsStore()
const { activePlaylist, activePlaylistId, persistenceError, persistenceStatus, playlists } =
	storeToRefs(store)
const toast = useToast()
const { t } = useI18n()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const deleteOpen = shallowRef(false)
const importing = shallowRef(false)
const dragging = shallowRef(false)
const resolveLegacy = useLegacyPlaylistResolver()
const items = computed(() =>
	playlists.value.map((playlist) => ({ label: playlist.name, value: playlist.id })),
)
const downloadable = computed(() => isPlaylistDownloadable(activePlaylist.value))
const statusIcon = computed(() => {
	if (persistenceStatus.value === 'error') return 'i-tabler-alert-triangle'
	if (persistenceStatus.value === 'saving' || persistenceStatus.value === 'loading') {
		return 'i-tabler-loader-2'
	}
	return 'i-tabler-circle-check'
})
const statusLabel = computed(
	() =>
		persistenceError.value ||
		{
			error: t('playlist.persistence.error'),
			idle: t('playlist.persistence.idle'),
			loading: t('playlist.persistence.loading'),
			saved: t('playlist.persistence.saved'),
			saving: t('playlist.persistence.saving'),
		}[persistenceStatus.value],
)

function duplicate() {
	store.duplicatePlaylist(activePlaylistId.value ?? '')
}

function removePlaylist() {
	store.deletePlaylist(activePlaylistId.value ?? '')
	deleteOpen.value = false
}

function download() {
	if (activePlaylist.value) downloadPlaylist(activePlaylist.value)
}

async function copyPath() {
	try {
		await navigator.clipboard.writeText('%AppData%\\Zeepkist\\Playlists')
		toast.add({ title: t('playlist.toasts.pathCopied'), color: 'success' })
	} catch {
		toast.add({ title: t('playlist.toasts.pathCopyFailed'), color: 'error' })
	}
}

function reportDescription(report: PlaylistImportReport) {
	const notes = [
		report.skippedDuplicates.length
			? t('playlist.import.duplicates', { count: report.skippedDuplicates.length })
			: '',
		report.skippedInvalid
			? t('playlist.import.invalid', { count: report.skippedInvalid })
			: '',
		report.truncatedOverflow
			? t('playlist.import.truncated', { count: report.truncatedOverflow })
			: '',
		report.unresolvedLegacyUids.length
			? t('playlist.import.unresolved', { count: report.unresolvedLegacyUids.length })
			: '',
	].filter(Boolean)
	return notes.join(' · ') || t('playlist.import.clean')
}

async function processFile(file: File) {
	if (file.size > PLAYLIST_MAX_FILE_SIZE) {
		toast.add({
			title: t('playlist.toasts.importFailed'),
			description: t('playlist.import.tooLarge'),
			color: 'error',
		})
		return
	}
	importing.value = true
	try {
		const { playlist, report } = await importPlaylistText(
			await file.text(),
			playlists.value.map((entry) => entry.name),
			resolveLegacy,
		)
		store.importPlaylist(playlist)
		toast.add({
			title: t('playlist.toasts.imported', { playlist: playlist.name }),
			description: reportDescription(report),
			color: 'success',
		})
	} catch (error) {
		toast.add({
			title: t('playlist.toasts.importFailed'),
			description: error instanceof Error ? error.message : String(error),
			color: 'error',
		})
	} finally {
		importing.value = false
	}
}

function importFile(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	if (file) void processFile(file)
}

function dropFile(event: DragEvent) {
	dragging.value = false
	const file = event.dataTransfer?.files[0]
	if (file) void processFile(file)
}
</script>

<template>
	<UCard
		class="border-border bg-card/85 transition-colors"
		:class="{ 'border-primary bg-primary/5': dragging }"
		@dragenter.prevent="dragging = true"
		@dragover.prevent="dragging = true"
		@dragleave.prevent="dragging = false"
		@drop.prevent="dropFile"
	>
		<div class="flex flex-wrap items-end gap-3">
			<UFormField :label="$t('playlist.library.current')" class="min-w-56 flex-1">
				<USelect
					:model-value="activePlaylistId ?? undefined"
					:items="items"
					value-key="value"
					class="w-full"
					:placeholder="$t('playlist.library.none')"
					@update:model-value="store.setActivePlaylist(String($event))"
				/>
			</UFormField>
			<UButton icon="i-tabler-plus" color="primary" @click="store.createPlaylist()">
				{{ $t('playlist.actions.new') }}
			</UButton>
			<UButton
				icon="i-tabler-copy"
				color="neutral"
				variant="soft"
				:disabled="!activePlaylist"
				@click="duplicate"
			>
				{{ $t('playlist.actions.duplicate') }}
			</UButton>
			<div
				class="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/25 p-1.5 pr-3 transition-colors"
				:class="{ 'border-primary bg-primary/10': dragging }"
			>
				<UButton
					icon="i-tabler-upload"
					color="neutral"
					variant="soft"
					:loading="importing"
					@click="fileInput?.click()"
				>
					{{ $t('playlist.actions.import') }}
				</UButton>
				<span class="text-xs text-muted-foreground">{{ $t('playlist.import.drop') }}</span>
				<input
					ref="fileInput"
					type="file"
					accept=".zeeplist,application/json"
					class="hidden"
					@change="importFile"
				>
			</div>
			<UButton icon="i-tabler-download" :disabled="!downloadable" @click="download">
				{{ $t('playlist.actions.download') }}
			</UButton>
			<UButton
				icon="i-tabler-trash"
				color="error"
				variant="soft"
				:disabled="!activePlaylist"
				@click="deleteOpen = true"
			>
				{{ $t('playlist.actions.delete') }}
			</UButton>
		</div>
		<div
			class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
		>
			<div class="flex items-center gap-2 text-muted-foreground">
				<UIcon :name="statusIcon" class="size-4" :class="{ 'animate-spin': persistenceStatus === 'saving' || persistenceStatus === 'loading' }" />
				<span>{{ statusLabel }}</span>
			</div>
			<div class="flex items-center gap-2 text-muted-foreground">
				<span>{{ $t('playlist.download.guidance') }}</span>
				<code>%AppData%\Zeepkist\Playlists</code>
				<UButton
					icon="i-tabler-copy"
					color="neutral"
					variant="ghost"
					square
					:aria-label="$t('playlist.actions.copyPath')"
					@click="copyPath"
				/>
			</div>
		</div>
	</UCard>

	<UModal
		v-model:open="deleteOpen"
		:title="$t('playlist.delete.title')"
		:description="$t('playlist.delete.description')"
	>
		<template #footer>
			<div class="flex w-full justify-end gap-2">
				<UButton color="neutral" variant="ghost" @click="deleteOpen = false">
					{{ $t('playlist.actions.cancel') }}
				</UButton>
				<UButton color="error" @click="removePlaylist">
					{{ $t('playlist.actions.delete') }}
				</UButton>
			</div>
		</template>
	</UModal>
</template>
