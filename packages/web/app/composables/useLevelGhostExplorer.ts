import { useClientHandle, useQuery } from '@urql/vue'
import type { Ref } from 'vue'
import {
	Zc_LevelGhostDefaultsDocument,
	Zc_LevelGhostPresetDocument,
	Zc_LevelGhostUserSearchDocument,
} from '~/graphql/generated/graphql'
import type { GhostRecordSource } from '~/types/ghost'
import type {
	LevelGhostPresetCount,
	LevelGhostPresetKind,
	LevelGhostSearchUser,
} from '~/types/levelGhostExplorer'
import { mapGhostRecordSource } from '~/utils/ghostRecordSource'
import {
	addIndividualLevelGhost,
	buildInitialLevelGhostSelection,
	buildLevelGhostFollowRecordIds,
	buildLevelGhostPresetFilter,
	buildPresetLevelGhostSelection,
	clearLevelGhostSelection,
	isLevelGhostBulkLocked,
	isLevelGhostPresetCount,
	LEVEL_GHOST_INDIVIDUAL_LIMIT,
	removeIndividualLevelGhost,
} from '~/utils/levelGhostSelection'

export const LEVEL_GHOST_USER_LIMIT = 8
export const LEVEL_GHOST_SEARCH_MINIMUM_LENGTH = 2
export const LEVEL_GHOST_SEARCH_DEBOUNCE_MS = 250

export type UseLevelGhostExplorerOptions = {
	active: Ref<boolean>
	levelId: Ref<number | undefined>
	viewerId: Ref<number | undefined>
}

function mapRecords(
	records: Parameters<typeof mapGhostRecordSource>[0][] | null | undefined,
): GhostRecordSource[] {
	return (records ?? []).map(mapGhostRecordSource).filter((record) => record.ghostUrl !== null)
}

export function useLevelGhostExplorer(options: UseLevelGhostExplorerOptions) {
	const { client } = useClientHandle()
	const hydrated = ref(false)
	const initialized = ref(false)
	const selectionTouched = ref(false)
	const activeSources = shallowRef<GhostRecordSource[]>([])
	const search = ref('')
	const debouncedSearch = ref('')
	const presetPending = ref<LevelGhostPresetKind | null>(null)
	const presetError = shallowRef<Error | null>(null)
	const sceneRevision = ref(0)
	let debounceTimer: ReturnType<typeof setTimeout> | undefined
	let presetRequestRevision = 0

	onMounted(() => {
		hydrated.value = true
	})

	watch(
		search,
		(value) => {
			if (debounceTimer) clearTimeout(debounceTimer)
			debouncedSearch.value = ''
			if (import.meta.server) return
			const normalized = value.trim()
			if (normalized.length < LEVEL_GHOST_SEARCH_MINIMUM_LENGTH) return
			debounceTimer = setTimeout(() => {
				debouncedSearch.value = normalized
			}, LEVEL_GHOST_SEARCH_DEBOUNCE_MS)
		},
		{ immediate: true },
	)

	onScopeDispose(() => {
		if (debounceTimer) clearTimeout(debounceTimer)
		presetRequestRevision += 1
	})

	const defaultsQuery = useQuery({
		query: Zc_LevelGhostDefaultsDocument,
		variables: computed(() => ({
			levelId: options.levelId.value ?? 0,
			viewerId: options.viewerId.value ?? 0,
			includeViewer: options.viewerId.value !== undefined,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				!hydrated.value ||
				!options.active.value ||
				options.levelId.value === undefined,
		),
	})

	const userSearchQuery = useQuery({
		query: Zc_LevelGhostUserSearchDocument,
		variables: computed(() => ({
			levelId: options.levelId.value ?? 0,
			search: debouncedSearch.value,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				!hydrated.value ||
				!options.active.value ||
				options.levelId.value === undefined ||
				debouncedSearch.value.length < LEVEL_GHOST_SEARCH_MINIMUM_LENGTH,
		),
	})

	const defaultsMatchLevel = computed(
		() => defaultsQuery.data.value?.level?.id === options.levelId.value,
	)
	const worldRecord = computed<GhostRecordSource | null>(() => {
		if (!defaultsMatchLevel.value) return null
		return mapRecords(defaultsQuery.data.value?.worldRecord?.nodes)[0] ?? null
	})
	const viewerPersonalBest = computed<GhostRecordSource | null>(() => {
		if (!defaultsMatchLevel.value) return null
		return mapRecords(defaultsQuery.data.value?.viewerPersonalBest?.nodes)[0] ?? null
	})

	watch(
		() => defaultsQuery.data.value,
		(data) => {
			if (
				initialized.value ||
				selectionTouched.value ||
				data?.level?.id !== options.levelId.value
			) {
				return
			}
			activeSources.value = buildInitialLevelGhostSelection(
				viewerPersonalBest.value,
				worldRecord.value,
			)
			initialized.value = true
			sceneRevision.value += 1
		},
		{ flush: 'sync' },
	)

	watch(options.levelId, (value, previous) => {
		if (value === previous) return
		presetRequestRevision += 1
		initialized.value = false
		selectionTouched.value = false
		activeSources.value = []
		presetError.value = null
		presetPending.value = null
		search.value = ''
		sceneRevision.value += 1
	})

	watch(options.viewerId, (value, previous) => {
		if (value === previous || selectionTouched.value) return
		initialized.value = false
	})

	const users = computed<LevelGhostSearchUser[]>(() => {
		if (userSearchQuery.data.value === undefined) return []
		return (userSearchQuery.data.value.users?.nodes ?? []).flatMap((user) => {
			if (!user.steamName) return []
			const personalBest = user.personalBestGlobals.nodes[0]?.record
			if (!personalBest) return []
			const mapped = mapGhostRecordSource(personalBest)
			if (!mapped.ghostUrl) return []
			return [
				{
					id: user.id,
					steamId: user.steamId == null ? null : String(user.steamId),
					name: user.steamName,
					personalBest: mapped,
				},
			]
		})
	})

	const bulkLocked = computed(() => isLevelGhostBulkLocked(activeSources.value))
	const canAddIndividual = computed(
		() =>
			initialized.value &&
			!bulkLocked.value &&
			activeSources.value.length < LEVEL_GHOST_INDIVIDUAL_LIMIT,
	)
	const followRecordIds = computed(() =>
		buildLevelGhostFollowRecordIds({
			sources: activeSources.value,
			viewerPersonalBest: viewerPersonalBest.value,
			worldRecord: worldRecord.value,
		}),
	)

	function replaceSelection(sources: readonly GhostRecordSource[]) {
		activeSources.value = [...sources]
		selectionTouched.value = true
		initialized.value = true
		sceneRevision.value += 1
	}

	function addSource(source: GhostRecordSource | null | undefined): boolean {
		if (!initialized.value) return false
		const next = addIndividualLevelGhost(activeSources.value, source)
		if (next.length === activeSources.value.length) return false
		replaceSelection(next)
		return true
	}

	function removeSource(recordId: number): boolean {
		const next = removeIndividualLevelGhost(activeSources.value, recordId)
		if (next.length === activeSources.value.length) return false
		replaceSelection(next)
		return true
	}

	function clearAll() {
		replaceSelection(clearLevelGhostSelection())
	}

	async function loadPreset(
		kind: LevelGhostPresetKind,
		count: LevelGhostPresetCount,
	): Promise<boolean> {
		const levelId = options.levelId.value
		if (
			import.meta.server ||
			!hydrated.value ||
			!options.active.value ||
			!initialized.value ||
			levelId === undefined ||
			!isLevelGhostPresetCount(count)
		) {
			return false
		}
		const filter = buildLevelGhostPresetFilter(kind, levelId, options.viewerId.value)
		if (!filter) return false

		const requestRevision = ++presetRequestRevision
		presetPending.value = kind
		presetError.value = null
		try {
			const result = await client
				.query(
					Zc_LevelGhostPresetDocument,
					{ first: count, filter },
					{ requestPolicy: 'network-only' },
				)
				.toPromise()
			if (requestRevision !== presetRequestRevision || levelId !== options.levelId.value) {
				return false
			}
			if (result.error) {
				presetError.value = result.error
				return false
			}
			const preset = mapRecords(result.data?.records?.nodes)
			replaceSelection(
				buildPresetLevelGhostSelection(viewerPersonalBest.value, worldRecord.value, preset),
			)
			return true
		} catch (error) {
			if (requestRevision === presetRequestRevision) {
				presetError.value = error instanceof Error ? error : new Error(String(error))
			}
			return false
		} finally {
			if (requestRevision === presetRequestRevision) presetPending.value = null
		}
	}

	return {
		activeSources: shallowReadonly(activeSources),
		addSource,
		bulkLocked,
		canAddIndividual,
		clearAll,
		debouncedSearch,
		defaultsQuery,
		followRecordIds,
		hydrated,
		initialized,
		loadPreset,
		presetError: readonly(presetError),
		presetPending: readonly(presetPending),
		removeSource,
		sceneRevision: readonly(sceneRevision),
		search,
		userSearchQuery,
		users,
		viewerPersonalBest,
		worldRecord,
	}
}
