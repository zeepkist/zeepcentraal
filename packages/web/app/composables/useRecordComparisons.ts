import { useQuery } from '@urql/vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import {
	Zc_RecordComparisonCatalogDocument,
	Zc_RecordComparisonRecordsDocument,
	Zc_RecordComparisonUserSearchDocument,
} from '~/graphql/generated/graphql'
import type { GhostRecordSource } from '~/types/ghost'
import type { RecordComparisonCatalog, RecordComparisonUser } from '~/types/recordDetail'
import { mapGhostRecordSource } from '~/utils/ghostRecordSource'

export const MAX_RECORD_COMPARISONS = 10
export const RECORD_COMPARISON_USER_LIMIT = 8
export const RECORD_COMPARISON_SEARCH_MINIMUM_LENGTH = 2
export const RECORD_COMPARISON_SEARCH_DEBOUNCE_MS = 250

export type UseRecordComparisonsOptions = {
	levelId: Ref<number | undefined>
	ownerId: Ref<number | undefined>
	viewerId: Ref<number | undefined>
	selectedRecordIds: Ref<readonly number[]>
	active?: MaybeRefOrGetter<boolean>
}

function isRecordId(value: number): boolean {
	return Number.isSafeInteger(value) && value > 0
}

export function normalizeComparisonRecordIds(recordIds: readonly number[]): number[] {
	return [...new Set(recordIds.filter(isRecordId))].slice(0, MAX_RECORD_COMPARISONS)
}

function mapRecords(
	records: Parameters<typeof mapGhostRecordSource>[0][] | undefined,
): GhostRecordSource[] {
	return (records ?? []).map(mapGhostRecordSource)
}

export function useRecordComparisons(options: UseRecordComparisonsOptions) {
	const hydrated = ref(false)
	const search = ref('')
	const debouncedSearch = ref('')
	const active = computed(() => toValue(options.active ?? true))
	const selectedRecordIds = computed(() =>
		normalizeComparisonRecordIds(options.selectedRecordIds.value),
	)
	let debounceTimer: ReturnType<typeof setTimeout> | undefined

	onMounted(() => {
		hydrated.value = true
	})

	watch(
		[search, active],
		([value, isActive]) => {
			if (debounceTimer) clearTimeout(debounceTimer)
			debouncedSearch.value = ''
			if (import.meta.server || !isActive) return
			const normalized = value.trim()
			if (normalized.length < RECORD_COMPARISON_SEARCH_MINIMUM_LENGTH) return
			debounceTimer = setTimeout(() => {
				debouncedSearch.value = normalized
			}, RECORD_COMPARISON_SEARCH_DEBOUNCE_MS)
		},
		{ immediate: true },
	)

	onScopeDispose(() => {
		if (debounceTimer) clearTimeout(debounceTimer)
	})

	const catalogQuery = useQuery({
		query: Zc_RecordComparisonCatalogDocument,
		variables: computed(() => ({
			levelId: options.levelId.value ?? 0,
			ownerId: options.ownerId.value ?? 0,
			viewerId: options.viewerId.value ?? 0,
			includeViewer: options.viewerId.value !== undefined,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				!active.value ||
				!hydrated.value ||
				options.levelId.value === undefined ||
				options.ownerId.value === undefined,
		),
	})
	const selectedQuery = useQuery({
		query: Zc_RecordComparisonRecordsDocument,
		variables: computed(() => ({
			levelId: options.levelId.value ?? 0,
			recordIds: selectedRecordIds.value,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				!active.value ||
				!hydrated.value ||
				options.levelId.value === undefined ||
				selectedRecordIds.value.length === 0,
		),
	})
	const userSearchQuery = useQuery({
		query: Zc_RecordComparisonUserSearchDocument,
		variables: computed(() => ({
			levelId: options.levelId.value ?? 0,
			search: debouncedSearch.value,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				!active.value ||
				!hydrated.value ||
				options.levelId.value === undefined ||
				debouncedSearch.value.length < RECORD_COMPARISON_SEARCH_MINIMUM_LENGTH,
		),
	})

	const catalog = computed<RecordComparisonCatalog>(() => ({
		topPersonalBests: mapRecords(catalogQuery.data.value?.topPersonalBests?.nodes),
		ownerRuns: mapRecords(catalogQuery.data.value?.ownerRuns?.nodes),
		viewerPersonalBest: catalogQuery.data.value?.viewerPersonalBest?.record
			? mapGhostRecordSource(catalogQuery.data.value.viewerPersonalBest.record)
			: null,
	}))
	const comparisons = computed<GhostRecordSource[]>(() =>
		mapRecords(selectedQuery.data.value?.records?.nodes),
	)
	const users = computed<RecordComparisonUser[]>(() =>
		(userSearchQuery.data.value?.users?.nodes ?? []).flatMap((user) => {
			if (!user.steamName) return []
			const personalBest = user.personalBestGlobals.nodes[0]?.record
			return [
				{
					id: user.id,
					steamId: user.steamId == null ? null : String(user.steamId),
					name: user.steamName,
					personalBest: personalBest ? mapGhostRecordSource(personalBest) : null,
				},
			]
		}),
	)

	return {
		catalog,
		catalogQuery,
		comparisons,
		debouncedSearch,
		hydrated,
		search,
		selectedQuery,
		selectedRecordIds,
		userSearchQuery,
		users,
	}
}
