import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'

import type { LevelSummary, LocalPlaylist, LocalPlaylistLevel } from '~/types/app'
import {
	clampPlaylistRoundLength,
	createLocalPlaylist,
	getUniquePlaylistName,
	PLAYLIST_MAX_LEVELS,
	parseSafeWorkshopId,
} from '~/utils/playlist'
import type { PlaylistDatabase, PlaylistDatabaseSnapshot } from '~/utils/playlistDatabase.client'

export type PlaylistPersistenceStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'
export type AddPlaylistLevelResult = 'added' | 'duplicate' | 'full' | 'invalid'

export const usePlaylistsStore = defineStore('playlists', () => {
	const playlists = ref<LocalPlaylist[]>([])
	const activePlaylistId = shallowRef<string | null>(null)
	const persistenceStatus = shallowRef<PlaylistPersistenceStatus>('idle')
	const persistenceError = shallowRef<string | null>(null)
	const hydrated = shallowRef(false)
	const activePlaylist = computed(
		() => playlists.value.find((playlist) => playlist.id === activePlaylistId.value) ?? null,
	)
	let database: PlaylistDatabase | undefined
	let saveTimer: ReturnType<typeof setTimeout> | undefined
	let saveQueue = Promise.resolve()

	function snapshot(): PlaylistDatabaseSnapshot {
		return {
			playlists: structuredClone(toRaw(playlists.value)),
			activePlaylistId: activePlaylistId.value,
		}
	}

	async function hydrate(repository?: PlaylistDatabase) {
		if (hydrated.value || import.meta.server) return
		persistenceStatus.value = 'loading'
		persistenceError.value = null
		try {
			database =
				repository ??
				new (await import('~/utils/playlistDatabase.client')).PlaylistDatabase()
			const stored = await database.load()
			playlists.value = stored.playlists
			activePlaylistId.value = stored.playlists.some(
				(playlist) => playlist.id === stored.activePlaylistId,
			)
				? stored.activePlaylistId
				: (stored.playlists[0]?.id ?? null)
			persistenceStatus.value = 'saved'
		} catch (error) {
			persistenceStatus.value = 'error'
			persistenceError.value = error instanceof Error ? error.message : String(error)
		} finally {
			hydrated.value = true
		}
	}

	function scheduleSave() {
		if (!hydrated.value || !database || import.meta.server) return
		if (saveTimer) clearTimeout(saveTimer)
		persistenceStatus.value = 'saving'
		saveTimer = setTimeout(() => void persistNow(), 350)
	}

	async function persistNow() {
		if (!database) return
		if (saveTimer) clearTimeout(saveTimer)
		saveTimer = undefined
		const pending = snapshot()
		saveQueue = saveQueue.catch(() => undefined).then(() => database?.save(pending))
		try {
			await saveQueue
			persistenceStatus.value = 'saved'
			persistenceError.value = null
		} catch (error) {
			persistenceStatus.value = 'error'
			persistenceError.value = error instanceof Error ? error.message : String(error)
		}
	}

	function touch(playlist: LocalPlaylist) {
		playlist.updatedAt = new Date().toISOString()
		scheduleSave()
	}

	function createPlaylist(name?: string) {
		const playlist = createLocalPlaylist(
			playlists.value.map((entry) => entry.name),
			name,
		)
		playlists.value.push(playlist)
		activePlaylistId.value = playlist.id
		scheduleSave()
		return playlist
	}

	function setActivePlaylist(id: string) {
		if (!playlists.value.some((playlist) => playlist.id === id)) return
		activePlaylistId.value = id
		scheduleSave()
	}

	function renamePlaylist(id: string, name: string) {
		const playlist = playlists.value.find((entry) => entry.id === id)
		if (!playlist) return
		playlist.name = getUniquePlaylistName(
			name,
			playlists.value.filter((entry) => entry.id !== id).map((entry) => entry.name),
		)
		touch(playlist)
	}

	function setRoundLength(id: string, roundLength: number) {
		const playlist = playlists.value.find((entry) => entry.id === id)
		if (!playlist) return
		playlist.roundLength = clampPlaylistRoundLength(roundLength)
		touch(playlist)
	}

	function setShuffle(id: string, shuffle: boolean) {
		const playlist = playlists.value.find((entry) => entry.id === id)
		if (!playlist) return
		playlist.shufflePlaylist = shuffle
		touch(playlist)
	}

	function duplicatePlaylist(id: string) {
		const source = playlists.value.find((playlist) => playlist.id === id)
		if (!source) return null
		const now = new Date().toISOString()
		const duplicate: LocalPlaylist = {
			...structuredClone(toRaw(source)),
			id: crypto.randomUUID(),
			name: getUniquePlaylistName(
				`${source.name} Copy`,
				playlists.value.map((playlist) => playlist.name),
			),
			createdAt: now,
			updatedAt: now,
		}
		playlists.value.push(duplicate)
		activePlaylistId.value = duplicate.id
		scheduleSave()
		return duplicate
	}

	function deletePlaylist(id: string) {
		const index = playlists.value.findIndex((playlist) => playlist.id === id)
		if (index < 0) return null
		const [deleted] = playlists.value.splice(index, 1)
		if (activePlaylistId.value === id) {
			activePlaylistId.value =
				playlists.value[index]?.id ?? playlists.value[index - 1]?.id ?? null
		}
		scheduleSave()
		return deleted ?? null
	}

	function importPlaylist(playlist: LocalPlaylist) {
		playlist.name = getUniquePlaylistName(
			playlist.name,
			playlists.value.map((entry) => entry.name),
		)
		playlists.value.push(playlist)
		activePlaylistId.value = playlist.id
		scheduleSave()
	}

	function toPlaylistLevel(level: LevelSummary): LocalPlaylistLevel | null {
		const WorkshopID = parseSafeWorkshopId(level.workshopId)
		if (!level.fileUid || WorkshopID === null) return null
		return {
			UID: level.fileUid,
			WorkshopID,
			Name: level.name,
			Author: level.fileAuthor || level.authorName || '',
			xxHash: level.xxHash,
			imageUrl: level.imageUrl ?? undefined,
		}
	}

	function addLevel(level: LevelSummary): AddPlaylistLevelResult {
		const item = toPlaylistLevel(level)
		if (!item) return 'invalid'
		const playlist = activePlaylist.value ?? createPlaylist()
		if (playlist.levels.length >= PLAYLIST_MAX_LEVELS) return 'full'
		if (playlist.levels.some((entry) => entry.UID === item.UID)) return 'duplicate'
		playlist.levels.push(item)
		touch(playlist)
		return 'added'
	}

	function addStoredLevel(level: LocalPlaylistLevel, index?: number) {
		const playlist = activePlaylist.value
		if (!playlist || playlist.levels.some((entry) => entry.UID === level.UID)) return false
		playlist.levels.splice(index ?? playlist.levels.length, 0, level)
		touch(playlist)
		return true
	}

	function removeLevel(uid: string) {
		const playlist = activePlaylist.value
		if (!playlist) return null
		const index = playlist.levels.findIndex((level) => level.UID === uid)
		if (index < 0) return null
		const [level] = playlist.levels.splice(index, 1)
		touch(playlist)
		return level ? { level, index } : null
	}

	function moveLevel(from: number, to: number) {
		const playlist = activePlaylist.value
		if (
			!playlist ||
			from === to ||
			from < 0 ||
			to < 0 ||
			from >= playlist.levels.length ||
			to >= playlist.levels.length
		) {
			return
		}
		const [level] = playlist.levels.splice(from, 1)
		if (!level) return
		playlist.levels.splice(to, 0, level)
		touch(playlist)
	}

	function setLevelOrder(levels: LocalPlaylistLevel[]) {
		const playlist = activePlaylist.value
		if (!playlist) return
		playlist.levels = levels
		touch(playlist)
	}

	function hasLevel(uid: string | null | undefined) {
		return Boolean(uid && activePlaylist.value?.levels.some((level) => level.UID === uid))
	}

	return {
		activePlaylist,
		activePlaylistId,
		hydrated,
		persistenceError,
		persistenceStatus,
		playlists,
		addLevel,
		addStoredLevel,
		createPlaylist,
		deletePlaylist,
		duplicatePlaylist,
		hasLevel,
		hydrate,
		importPlaylist,
		moveLevel,
		persistNow,
		removeLevel,
		renamePlaylist,
		setActivePlaylist,
		setLevelOrder,
		setRoundLength,
		setShuffle,
	}
})
