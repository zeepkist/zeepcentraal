import { useQuery } from '@urql/vue'
import {
	calculateDecayMultiplier,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import type { Ref } from 'vue'
import { Zc_RecordHistoryDocument } from '~/graphql/generated/graphql'
import type { CursorPage, RecordHistoryRow } from '~/types/app'
import {
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

type RecordHistoryOptions = {
	userId?: Ref<number | undefined>
	view: Ref<RecordHistoryView>
	sort: Ref<RecordHistorySort>
	namespace: string
}

export function useRecordHistory(options: RecordHistoryOptions) {
	const pagination = useCursorPagination(25, options.namespace)
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
	const rows = computed<RecordHistoryRow[]>(() =>
		(result.data.value?.records?.edges ?? []).flatMap(({ node }) => {
			if (!node.level) return []
			const contribution = node.userPointContributions.nodes[0]
			return [
				{
					id: node.id,
					time: node.time,
					dateCreated: String(node.dateCreated),
					userId: node.userId,
					userSteamId: node.user?.steamId ? String(node.user.steamId) : null,
					userName: node.user?.steamName,
					levelId: node.levelId,
					levelXxHash: node.level.xxHash,
					levelName: node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
					levelPosition: contribution?.levelPosition,
					contributionRank: contribution?.contributionRank,
					levelPoints: contribution?.levelPoints,
					levelDecayedPoints: contribution?.levelDecayedPoints,
					playerDecayedPoints: contribution?.playerDecayedPoints,
					levelDecayMultiplier: contribution
						? calculateDecayMultiplier(contribution.levelPosition, LEVEL_DECAY_FACTOR)
						: undefined,
					globalDecayMultiplier: contribution
						? calculateDecayMultiplier(
								contribution.contributionRank,
								GLOBAL_DECAY_FACTOR,
							)
						: undefined,
				},
			]
		}),
	)
	const page = computed(() => pageInfo(result.data.value?.records?.pageInfo))

	async function setView(next: RecordHistoryView) {
		await pagination.reset({ view: next === 'recent' ? undefined : next })
	}

	async function setSort(next: RecordHistorySort) {
		await pagination.reset({ sort: next === 'latest' ? undefined : next })
	}

	return {
		filter,
		orderBy,
		page,
		pagination,
		result,
		rows,
		setSort,
		setView,
	}
}
