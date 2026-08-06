import { useQuery } from '@urql/vue'
import {
	calculateDecayMultiplier,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import {
	type UserPointContributionsOrderBy,
	Zc_UserContributionsDocument,
	Zc_UserResultsDocument,
} from '@zeepkist/graphql/generated'
import type { MaybeRefOrGetter } from 'vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'
import type { CursorPage, RecordHistoryRow } from '~/types/app'
import { getLevelDisplayName } from '~/utils/levelDisplay'
import { resolveRecordPbOrWr } from '~/utils/levelRecordRows'
import type { RecordHistorySort } from '~/utils/recordHistory'

function cursorPage(
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

export function useUserResults(
	steamId: Ref<string>,
	summaryData: UserProfileSummaryModel,
	active: MaybeRefOrGetter<boolean>,
) {
	const personalBestsPrefetch = useViewportPrefetch()
	const recentPrefetch = useViewportPrefetch()
	const user = summaryData.user
	const userId = computed(() => user.value?.id)
	const recentPagination = useCursorPagination(25, 'recent')
	const wrPagination = useCursorPagination(25, 'wr')
	const pbPagination = useCursorPagination(25, 'pb')
	const wrSort = ref<RecordHistorySort>('valuable-pbs')
	const pbSort = ref<RecordHistorySort>('valuable-pbs')
	const contributionOrderBy = (sort: RecordHistorySort): UserPointContributionsOrderBy[] =>
		sort === 'valuable-levels'
			? ['LEVEL_POINTS_DESC', 'RECORD_ID_DESC']
			: ['PLAYER_DECAYED_POINTS_DESC', 'RECORD_ID_DESC']

	const wrValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, levelPosition: { equalTo: 1 } },
			orderBy: contributionOrderBy(wrSort.value),
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				wrSort.value === 'latest',
		),
	})
	const pbValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 } },
			orderBy: contributionOrderBy(pbSort.value),
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				pbSort.value === 'latest' ||
				!personalBestsPrefetch.active.value,
		),
	})
	const wrRecent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, worldRecordGlobalsExist: true },
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				wrSort.value !== 'latest',
		),
	})
	const pbRecent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: {
				userId: { equalTo: userId.value ?? 0 },
				personalBestGlobalsExist: true,
			},
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				pbSort.value !== 'latest' ||
				!personalBestsPrefetch.active.value,
		),
	})
	const recent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...recentPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 } },
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				!recentPrefetch.active.value,
		),
	})

	const contributionRows = (source: typeof wrValuable) =>
		computed<RecordHistoryRow[]>(() =>
			(source.data.value?.userPointContributions?.edges ?? []).flatMap(({ node }) =>
				node.record && node.level
					? [
							{
								id: node.record.id,
								time: node.record.time,
								dateCreated: String(node.record.dateCreated),
								userId: node.record.userId,
								userSteamId: steamId.value,
								userName: user.value?.steamName,
								levelId: node.record.levelId,
								levelXxHash: node.level.xxHash,
								levelName: getLevelDisplayName(
									node.level.levelItems.nodes[0]?.name,
									node.level.xxHash,
								),
								levelPosition: node.levelPosition,
								contributionRank: node.contributionRank,
								levelPoints: node.levelPoints,
								levelDecayedPoints: node.levelDecayedPoints,
								playerDecayedPoints: node.playerDecayedPoints,
								levelDecayMultiplier: calculateDecayMultiplier(
									node.levelPosition,
									LEVEL_DECAY_FACTOR,
								),
								globalDecayMultiplier: calculateDecayMultiplier(
									node.contributionRank,
									GLOBAL_DECAY_FACTOR,
								),
								pbOrWr: node.levelPosition === 1 ? 'world-record' : 'personal-best',
							},
						]
					: [],
			),
		)
	const resultRows = (source: typeof recent) =>
		computed<RecordHistoryRow[]>(() =>
			(source.data.value?.records?.edges ?? []).flatMap(({ node }) => {
				if (!node.level) return []
				const status = resolveRecordPbOrWr(node)
				const contribution = status ? node.userPointContributions.nodes[0] : undefined
				return [
					{
						id: node.id,
						time: node.time,
						dateCreated: String(node.dateCreated),
						userId: node.userId,
						userSteamId: steamId.value,
						userName: user.value?.steamName,
						levelId: node.levelId,
						levelXxHash: node.level.xxHash,
						levelName: getLevelDisplayName(
							node.level.levelItems.nodes[0]?.name,
							node.level.xxHash,
						),
						levelPosition: contribution?.levelPosition,
						contributionRank: contribution?.contributionRank,
						levelPoints: contribution?.levelPoints ?? node.level.levelPoints?.points,
						levelDecayedPoints: contribution?.levelDecayedPoints,
						playerDecayedPoints: contribution?.playerDecayedPoints,
						levelDecayMultiplier:
							contribution?.levelPosition == null
								? undefined
								: calculateDecayMultiplier(
										contribution.levelPosition,
										LEVEL_DECAY_FACTOR,
									),
						globalDecayMultiplier:
							contribution?.contributionRank == null
								? undefined
								: calculateDecayMultiplier(
										contribution.contributionRank,
										GLOBAL_DECAY_FACTOR,
									),
						pbOrWr: status,
					},
				]
			}),
		)
	const wrValuableRows = contributionRows(wrValuable)
	const pbValuableRows = contributionRows(pbValuable)
	const wrRecentRows = resultRows(wrRecent)
	const pbRecentRows = resultRows(pbRecent)
	const recentRowsSource = resultRows(recent)
	const wrRowsSource = computed(() =>
		wrSort.value === 'latest' ? wrRecentRows.value : wrValuableRows.value,
	)
	const pbRowsSource = computed(() =>
		pbSort.value === 'latest' ? pbRecentRows.value : pbValuableRows.value,
	)
	const wrResult = computed(() => (wrSort.value === 'latest' ? wrRecent : wrValuable))
	const pbResult = computed(() => (pbSort.value === 'latest' ? pbRecent : pbValuable))
	const wrRowsResolved = useRecordRankFallback(wrRowsSource)
	const pbRowsResolved = useRecordRankFallback(pbRowsSource)
	const recentRowsResolved = useRecordRankFallback(recentRowsSource)
	function retainRows(rows: ComputedRef<RecordHistoryRow[]>, hasSnapshot: ComputedRef<boolean>) {
		const retained = shallowRef<RecordHistoryRow[]>([])
		watch(
			[rows, hasSnapshot],
			([nextRows, ready]) => {
				if (ready) retained.value = nextRows
			},
			{ immediate: true, flush: 'sync' },
		)
		return shallowReadonly(retained)
	}
	const wrRows = retainRows(
		wrRowsResolved,
		computed(() => wrResult.value.data.value !== undefined),
	)
	const pbRows = retainRows(
		pbRowsResolved,
		computed(() => pbResult.value.data.value !== undefined),
	)
	const recentRows = retainRows(
		recentRowsResolved,
		computed(() => recent.data.value !== undefined),
	)
	const wrPage = computed(() =>
		cursorPage(
			wrSort.value !== 'latest'
				? wrValuable.data.value?.userPointContributions?.pageInfo
				: wrRecent.data.value?.records?.pageInfo,
		),
	)
	const pbPage = computed(() =>
		cursorPage(
			pbSort.value !== 'latest'
				? pbValuable.data.value?.userPointContributions?.pageInfo
				: pbRecent.data.value?.records?.pageInfo,
		),
	)
	const recentPage = computed(() => cursorPage(recent.data.value?.records?.pageInfo))

	async function setWrSort(value: RecordHistorySort) {
		wrSort.value = value
		await wrPagination.reset()
	}
	async function setPbSort(value: RecordHistorySort) {
		pbSort.value = value
		await pbPagination.reset()
	}

	return {
		personalBestsActive: personalBestsPrefetch.active,
		personalBestsTarget: personalBestsPrefetch.target,
		pbPage,
		pbPagination,
		pbResult,
		pbRows,
		pbSort,
		recent,
		recentActive: recentPrefetch.active,
		recentPage,
		recentPagination,
		recentRows,
		recentTarget: recentPrefetch.target,
		setPbSort,
		setWrSort,
		wrPage,
		wrPagination,
		wrResult,
		wrRows,
		wrSort,
	}
}
