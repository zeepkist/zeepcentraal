import { useQuery, useSubscription } from '@urql/vue'
import {
	calculateDecayMultiplier,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import type { Ref } from 'vue'
import { useRecordRankFallback } from '~/composables/useRecordRankFallback'
import {
	Zc_RecordHistoryDocument,
	Zc_RecordHistoryLiveDocument,
	type Zc_RecordHistoryLiveSubscription,
	type Zc_RecordHistoryRowFragment,
} from '~/graphql/generated/graphql'
import type { CursorPage, RecordHistoryRow, RecordHistoryUpdate } from '~/types/app'
import { getLevelDisplayName } from '~/utils/levelDisplay'
import {
	getNewRecordIds,
	getRecordResultStatus,
	type RecordHistorySort,
	type RecordHistoryView,
	recordHistoryFilter,
	recordHistoryOrder,
} from '~/utils/recordHistory'

function pageInfo(
	info?: {
		startCursor?: unknown
		endCursor?: unknown
		hasNextPage: boolean
		hasPreviousPage: boolean
	} | null,
): CursorPage {
	return info
		? {
				startCursor: String(info.startCursor ?? '') || null,
				endCursor: String(info.endCursor ?? '') || null,
				hasNextPage: info.hasNextPage,
				hasPreviousPage: info.hasPreviousPage,
			}
		: { hasNextPage: false, hasPreviousPage: false }
}

function mapRows(edges?: Array<{ node: Zc_RecordHistoryRowFragment }>): RecordHistoryRow[] {
	return (edges ?? []).flatMap(({ node }) => {
		if (
			node.time == null ||
			node.dateCreated == null ||
			node.levelId == null ||
			node.userId == null ||
			node.levelXxHash == null
		) {
			return []
		}
		return [
			{
				id: node.id,
				time: node.time,
				dateCreated: String(node.dateCreated),
				userId: node.userId,
				userSteamId: node.userSteamId ? String(node.userSteamId) : null,
				userName: node.userName,
				levelId: node.levelId,
				levelXxHash: node.levelXxHash,
				levelName: getLevelDisplayName(node.levelName, node.levelXxHash),
				levelPosition: node.levelPosition,
				contributionRank: node.contributionRank,
				levelPoints: node.levelPoints,
				levelDecayedPoints: node.levelDecayedPoints,
				playerDecayedPoints: node.playerDecayedPoints,
				levelDecayMultiplier:
					node.hasContribution && node.levelPosition != null
						? calculateDecayMultiplier(node.levelPosition, LEVEL_DECAY_FACTOR)
						: undefined,
				globalDecayMultiplier:
					node.hasContribution && node.contributionRank != null
						? calculateDecayMultiplier(node.contributionRank, GLOBAL_DECAY_FACTOR)
						: undefined,
				pbOrWr: getRecordResultStatus(
					node.isPersonalBest ? 1 : 0,
					node.isWorldRecord ? 1 : 0,
				),
			},
		]
	})
}

type RecordHistoryOptions = {
	userId?: Ref<number | undefined>
	view: Ref<RecordHistoryView>
	sort: Ref<RecordHistorySort>
	namespace: string
}

type LivePacket = { key: string; data: Zc_RecordHistoryLiveSubscription }

export function useRecordHistory(options: RecordHistoryOptions) {
	const pagination = useCursorPagination(25, options.namespace)
	const mounted = ref(false)
	const pageFocused = usePageFocus()
	const activation = ref(0)
	const highlightedRecordIds = ref<ReadonlySet<number>>(new Set())
	const newRecordBatch = shallowRef<RecordHistoryUpdate | null>(null)
	const highlightTimers = new Map<number, ReturnType<typeof setTimeout>>()
	const filter = computed(() =>
		recordHistoryFilter(options.view.value, options.sort.value, options.userId?.value),
	)
	const orderBy = computed(() => recordHistoryOrder(options.sort.value))
	const result = useQuery({
		query: Zc_RecordHistoryDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
			orderBy: orderBy.value,
		})),
		pause: computed(() => options.userId !== undefined && !options.userId.value),
	})
	const liveEligible = computed(
		() =>
			options.sort.value === 'latest' &&
			pagination.isFirstPage.value &&
			result.data.value?.recordHistoryEntries !== undefined &&
			(options.userId === undefined || options.userId.value !== undefined),
	)
	const liveEnabled = computed(() => mounted.value && liveEligible.value)
	const liveKey = computed(() =>
		JSON.stringify({
			activation: activation.value,
			userId: options.userId?.value,
			view: options.view.value,
		}),
	)
	const live = useSubscription(
		{
			query: Zc_RecordHistoryLiveDocument,
			variables: computed(() => ({ filter: filter.value })),
			pause: computed(() => import.meta.server || !liveEnabled.value || !pageFocused.value),
		},
		(_previous: LivePacket | undefined, data): LivePacket => ({ key: liveKey.value, data }),
	)
	const liveSnapshot = computed(() =>
		live.data.value?.key === liveKey.value
			? live.data.value.data.recordHistoryEntries
			: undefined,
	)
	const liveReady = computed(
		() => liveEnabled.value && liveSnapshot.value !== undefined && !live.error.value,
	)
	const liveStatus = computed(() => {
		if (!liveEligible.value) return 'paused' as const
		if (live.error.value) return 'error' as const
		return liveReady.value ? ('live' as const) : ('connecting' as const)
	})
	const records = computed(
		() =>
			(liveEnabled.value ? liveSnapshot.value : undefined) ??
			result.data.value?.recordHistoryEntries,
	)
	const rawRows = computed(() => mapRows(records.value?.edges))
	const rows = useRecordRankFallback(rawRows)
	const page = computed(() => pageInfo(records.value?.pageInfo))

	function clearHighlights() {
		for (const timer of highlightTimers.values()) clearTimeout(timer)
		highlightTimers.clear()
		highlightedRecordIds.value = new Set()
	}

	function highlight(recordIds: number[]) {
		if (recordIds.length === 0) return
		highlightedRecordIds.value = new Set([...highlightedRecordIds.value, ...recordIds])
		for (const recordId of recordIds) {
			const existing = highlightTimers.get(recordId)
			if (existing) clearTimeout(existing)
			highlightTimers.set(
				recordId,
				setTimeout(() => {
					const next = new Set(highlightedRecordIds.value)
					next.delete(recordId)
					highlightedRecordIds.value = next
					highlightTimers.delete(recordId)
				}, 10_000),
			)
		}
	}

	let packetKey: string | undefined
	let knownRecordIds = new Set<number>()
	let updateSequence = 0
	watch(
		() => live.data.value,
		(packet) => {
			if (!packet || packet.key !== liveKey.value || !packet.data.recordHistoryEntries) return
			const nextIds = new Set(
				packet.data.recordHistoryEntries.edges.map(({ node }) => node.id),
			)
			if (packetKey !== packet.key) {
				packetKey = packet.key
				knownRecordIds = nextIds
				return
			}
			const newRecordIds = getNewRecordIds(knownRecordIds, nextIds)
			highlight(newRecordIds)
			if (newRecordIds.length > 0) {
				const added = new Set(newRecordIds)
				newRecordBatch.value = {
					sequence: ++updateSequence,
					records: mapRows(packet.data.recordHistoryEntries.edges).filter((record) =>
						added.has(record.id),
					),
				}
			}
			knownRecordIds = nextIds
		},
	)
	watch(liveKey, () => {
		packetKey = undefined
		knownRecordIds = new Set()
		newRecordBatch.value = null
		clearHighlights()
	})
	watch(liveEnabled, (enabled, wasEnabled) => {
		if (enabled && !wasEnabled) activation.value += 1
		if (!enabled) clearHighlights()
	})
	onMounted(() => {
		mounted.value = true
	})
	onScopeDispose(clearHighlights)

	async function setView(next: RecordHistoryView) {
		await pagination.reset({ view: next === 'recent' ? undefined : next })
	}

	async function setSort(next: RecordHistorySort) {
		await pagination.reset({ sort: next === 'latest' ? undefined : next })
	}

	return {
		filter,
		highlightedRecordIds,
		live,
		liveEnabled,
		liveEligible,
		liveReady,
		liveStatus,
		newRecordBatch,
		orderBy,
		page,
		pagination,
		result,
		rows,
		setSort,
		setView,
	}
}
