import { useQuery } from '@urql/vue'
import {
	Zc_UserContributionsDocument,
	Zc_UserProfileDocument,
	Zc_UserResultsDocument,
	Zc_UserStatisticsDocument,
} from '~/graphql/generated/graphql'
import type { CursorPage, RecordRow } from '~/types/app'

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

export function useUserProfile(steamId: Ref<string>) {
	const statisticsPrefetch = useViewportPrefetch()
	const worldRecordsPrefetch = useViewportPrefetch()
	const personalBestsPrefetch = useViewportPrefetch()
	const recentPrefetch = useViewportPrefetch()
	const profile = useQuery({
		query: Zc_UserProfileDocument,
		variables: computed(() => ({ steamId: steamId.value })),
	})
	const user = computed(() => profile.data.value?.users?.nodes[0])
	const userId = computed(() => user.value?.id)
	const statistics = useQuery({
		query: Zc_UserStatisticsDocument,
		variables: computed(() => ({ userId: userId.value ?? 0 })),
		pause: computed(() => userId.value === undefined || !statisticsPrefetch.active.value),
	})

	const recentPagination = useCursorPagination(25, 'recent')
	const wrPagination = useCursorPagination(25, 'wr')
	const pbPagination = useCursorPagination(25, 'pb')
	const wrSort = ref<'valuable' | 'recent'>('valuable')
	const pbSort = ref<'valuable' | 'recent'>('valuable')

	const wrValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...wrPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, levelPosition: { equalTo: 1 } },
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				wrSort.value !== 'valuable' ||
				!worldRecordsPrefetch.active.value,
		),
	})
	const pbValuable = useQuery({
		query: Zc_UserContributionsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 }, levelPosition: { greaterThan: 1 } },
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				pbSort.value !== 'valuable' ||
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
				userId.value === undefined ||
				wrSort.value !== 'recent' ||
				!worldRecordsPrefetch.active.value,
		),
	})
	const pbRecent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...pbPagination.variables.value,
			filter: {
				userId: { equalTo: userId.value ?? 0 },
				personalBestGlobalsExist: true,
				worldRecordGlobalsExist: false,
			},
		})),
		pause: computed(
			() =>
				userId.value === undefined ||
				pbSort.value !== 'recent' ||
				!personalBestsPrefetch.active.value,
		),
	})
	const recent = useQuery({
		query: Zc_UserResultsDocument,
		variables: computed(() => ({
			...recentPagination.variables.value,
			filter: { userId: { equalTo: userId.value ?? 0 } },
		})),
		pause: computed(() => userId.value === undefined || !recentPrefetch.active.value),
	})

	const contributionRows = (source: typeof wrValuable) =>
		computed<RecordRow[]>(() =>
			(source.data.value?.userPointContributions?.edges ?? []).flatMap(({ node }) =>
				node.record && node.level
					? [
							{
								id: node.record.id,
								time: node.record.time,
								dateCreated: String(node.record.dateCreated),
								userId: node.record.userId,
								levelId: node.record.levelId,
								levelXxHash: node.level.xxHash,
								levelName:
									node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
								rank: node.levelPosition,
								value: node.playerDecayedPoints,
							},
						]
					: [],
			),
		)
	const resultRows = (source: typeof recent) =>
		computed<RecordRow[]>(() =>
			(source.data.value?.records?.edges ?? []).flatMap(({ node }) =>
				node.level
					? [
							{
								id: node.id,
								time: node.time,
								dateCreated: String(node.dateCreated),
								userId: node.userId,
								levelId: node.levelId,
								levelXxHash: node.level.xxHash,
								levelName:
									node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
								rank: node.userPointContributions.nodes[0]?.levelPosition,
								value: node.userPointContributions.nodes[0]?.playerDecayedPoints,
							},
						]
					: [],
			),
		)
	const wrValuableRows = contributionRows(wrValuable)
	const pbValuableRows = contributionRows(pbValuable)
	const wrRecentRows = resultRows(wrRecent)
	const pbRecentRows = resultRows(pbRecent)
	const recentRows = resultRows(recent)
	const wrRows = computed(() =>
		wrSort.value === 'valuable' ? wrValuableRows.value : wrRecentRows.value,
	)
	const pbRows = computed(() =>
		pbSort.value === 'valuable' ? pbValuableRows.value : pbRecentRows.value,
	)
	const wrResult = computed(() => (wrSort.value === 'valuable' ? wrValuable : wrRecent))
	const pbResult = computed(() => (pbSort.value === 'valuable' ? pbValuable : pbRecent))
	const wrPage = computed(() =>
		cursorPage(
			wrSort.value === 'valuable'
				? wrValuable.data.value?.userPointContributions?.pageInfo
				: wrRecent.data.value?.records?.pageInfo,
		),
	)
	const pbPage = computed(() =>
		cursorPage(
			pbSort.value === 'valuable'
				? pbValuable.data.value?.userPointContributions?.pageInfo
				: pbRecent.data.value?.records?.pageInfo,
		),
	)
	const recentPage = computed(() => cursorPage(recent.data.value?.records?.pageInfo))

	async function setWrSort(value: 'valuable' | 'recent') {
		wrSort.value = value
		await wrPagination.reset()
	}
	async function setPbSort(value: 'valuable' | 'recent') {
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
		profile,
		recent,
		recentActive: recentPrefetch.active,
		recentPage,
		recentPagination,
		recentRows,
		recentTarget: recentPrefetch.target,
		setPbSort,
		setWrSort,
		statistics,
		statisticsActive: statisticsPrefetch.active,
		statisticsTarget: statisticsPrefetch.target,
		user,
		wrPage,
		wrPagination,
		wrResult,
		wrRows,
		wrSort,
		worldRecordsActive: worldRecordsPrefetch.active,
		worldRecordsTarget: worldRecordsPrefetch.target,
	}
}
