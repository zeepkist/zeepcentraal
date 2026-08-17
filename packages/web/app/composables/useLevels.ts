import { useQuery } from '@urql/vue'
import {
	type LevelsOrderBy,
	Zc_HotLevelsDocument,
	Zc_LevelsDocument,
	Zc_UserSuggestionsDocument,
} from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type { CursorPage, LevelSummary, SortOption } from '~/types/app'
import { getLevelDisplayName } from '~/utils/levelDisplay'
import {
	buildLevelFilter,
	getHotLevelSince,
	getLevelHotWindows,
	HOT_LEVEL_SORTS,
	isHotLevelSort,
	LEVEL_POINTS_MAX,
	LEVEL_POINTS_MIN,
	LEVEL_RATING_MAX,
	LEVEL_RATING_MIN,
	type LevelRange,
	normalizeLevelRange,
	normalizeViewerLevelFilter,
} from '~/utils/levelExplorer'

export const LEVEL_SORTS = {
	latest: 'DATE_CREATED_DESC',
	points: 'LEVEL_POINTS_POINTS_DESC',
	rating: 'LEVEL_POINTS_RATING_DESC',
	records: 'RECORDS_COUNT_DESC',
	votes: 'VOTES_COUNT_DESC',
	favourites: 'FAVOURITES_COUNT_DESC',
	hotYear: HOT_LEVEL_SORTS.year,
	hotMonth: HOT_LEVEL_SORTS.month,
	hotToday: HOT_LEVEL_SORTS.today,
} as const

export type LevelSort = (typeof LEVEL_SORTS)[keyof typeof LEVEL_SORTS]

export function useLevels(viewerId: Ref<number | undefined>) {
	const route = useRoute()
	const pagination = useCursorPagination(24)
	const hotWindows = useState('level-explorer-hot-windows', () => getLevelHotWindows())
	const validSorts = Object.values(LEVEL_SORTS) as readonly string[]
	const appliedSearch = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
	const appliedAuthor = computed(() =>
		typeof route.query.author === 'string' ? route.query.author : '',
	)
	const appliedAdventure = computed<'all' | 'yes' | 'no'>(() =>
		route.query.adventure === 'yes' || route.query.adventure === 'no'
			? route.query.adventure
			: 'all',
	)
	const appliedSort = computed<LevelSort>(() =>
		validSorts.includes(String(route.query.sort))
			? (route.query.sort as LevelSort)
			: LEVEL_SORTS.points,
	)
	const appliedPoints = computed(() =>
		normalizeLevelRange(
			route.query.pointsMin,
			route.query.pointsMax,
			LEVEL_POINTS_MIN,
			LEVEL_POINTS_MAX,
		),
	)
	const appliedRating = computed(() =>
		normalizeLevelRange(
			route.query.ratingMin,
			route.query.ratingMax,
			LEVEL_RATING_MIN,
			LEVEL_RATING_MAX,
		),
	)
	const appliedPersonalBest = computed(() => normalizeViewerLevelFilter(route.query.pb))
	const appliedWorldRecord = computed(() => normalizeViewerLevelFilter(route.query.wr))

	const search = ref(appliedSearch.value)
	const author = ref(appliedAuthor.value)
	const adventure = ref(appliedAdventure.value)
	const sort = ref<LevelSort>(appliedSort.value)
	const points = ref<LevelRange>([...appliedPoints.value])
	const rating = ref<LevelRange>([...appliedRating.value])
	const personalBest = ref(appliedPersonalBest.value)
	const worldRecord = ref(appliedWorldRecord.value)

	watch(
		[
			appliedSearch,
			appliedAuthor,
			appliedAdventure,
			appliedSort,
			appliedPoints,
			appliedRating,
			appliedPersonalBest,
			appliedWorldRecord,
		],
		(values) => {
			search.value = values[0] as string
			author.value = values[1] as string
			adventure.value = values[2] as 'all' | 'yes' | 'no'
			sort.value = values[3] as LevelSort
			points.value = [...(values[4] as LevelRange)]
			rating.value = [...(values[5] as LevelRange)]
			personalBest.value = values[6] as 'all' | 'yes' | 'no'
			worldRecord.value = values[7] as 'all' | 'yes' | 'no'
		},
	)

	const filter = computed(() =>
		buildLevelFilter({
			type: appliedAdventure.value,
			sort: appliedSort.value,
			search: appliedSearch.value,
			author: appliedAuthor.value,
			points: appliedPoints.value,
			rating: appliedRating.value,
			personalBest: appliedPersonalBest.value,
			worldRecord: appliedWorldRecord.value,
			viewerId: viewerId.value,
		}),
	)
	const hotSort = computed(() => isHotLevelSort(appliedSort.value))
	const normalResult = useQuery({
		query: Zc_LevelsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
			orderBy: [
				isHotLevelSort(appliedSort.value)
					? LEVEL_SORTS.points
					: (appliedSort.value as LevelsOrderBy),
			],
		})),
		pause: hotSort,
	})
	const hotResult = useQuery({
		query: Zc_HotLevelsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
			since:
				getHotLevelSince(appliedSort.value, hotWindows.value) ??
				hotWindows.value.todaySince,
		})),
		pause: computed(() => !hotSort.value),
	})
	const result = {
		data: computed(() => (hotSort.value ? hotResult.data.value : normalResult.data.value)),
		fetching: computed(() =>
			hotSort.value ? hotResult.fetching.value : normalResult.fetching.value,
		),
		error: computed(() => (hotSort.value ? hotResult.error.value : normalResult.error.value)),
	}
	const connection = computed(() => result.data.value?.levels)

	const debouncedAuthor = ref('')
	let authorTimer: ReturnType<typeof setTimeout> | undefined
	watch(
		author,
		(value) => {
			if (authorTimer) clearTimeout(authorTimer)
			if (import.meta.server) return
			authorTimer = setTimeout(() => {
				debouncedAuthor.value = value.trim()
			}, 250)
		},
		{ immediate: true },
	)
	onScopeDispose(() => {
		if (authorTimer) clearTimeout(authorTimer)
	})
	const authorSuggestionsResult = useQuery({
		query: Zc_UserSuggestionsDocument,
		variables: computed(() => ({ search: debouncedAuthor.value })),
		pause: computed(() => import.meta.server || debouncedAuthor.value.length < 2),
	})
	const authorSuggestions = computed<SortOption[]>(() =>
		(authorSuggestionsResult.data.value?.users?.nodes ?? []).flatMap((user) =>
			user.steamName ? [{ label: user.steamName, value: String(user.steamId) }] : [],
		),
	)

	const levels = computed<LevelSummary[]>(() =>
		(connection.value?.edges ?? []).map(({ node }) => {
			const item = node.levelItems.nodes[0]
			return {
				id: node.id,
				xxHash: node.xxHash,
				fileUid: item?.fileUid,
				fileAuthor: item?.fileAuthor,
				name: getLevelDisplayName(item?.name, node.xxHash),
				imageUrl: item?.imageUrl,
				authorName: item?.author?.steamName,
				authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
				workshopId: item?.workshopId == null ? null : String(item.workshopId),
				adventure: node.adventure,
				dateCreated: String(node.dateCreated),
				points: node.levelPoints?.points,
				rating: node.levelPoints?.rating,
				recordCount: node.records.totalCount,
				personalBestCount: node.personalBestGlobals.totalCount,
				voteCount: node.votes.totalCount,
				worldRecordTime: node.worldRecordGlobal?.record?.time,
				worldRecordAuthorName: node.worldRecordGlobal?.user?.steamName,
				worldRecordAuthorSteamId:
					node.worldRecordGlobal?.user?.steamId == null
						? null
						: String(node.worldRecordGlobal.user.steamId),
				medals: item
					? {
							author: item.validationTimeAuthor,
							gold: item.validationTimeGold,
							silver: item.validationTimeSilver,
							bronze: item.validationTimeBronze,
						}
					: null,
			}
		}),
	)
	const page = computed<CursorPage>(() =>
		connection.value?.pageInfo
			? {
					startCursor: String(connection.value.pageInfo.startCursor ?? '') || null,
					endCursor: String(connection.value.pageInfo.endCursor ?? '') || null,
					hasNextPage: connection.value.pageInfo.hasNextPage,
					hasPreviousPage: connection.value.pageInfo.hasPreviousPage,
				}
			: { hasNextPage: false, hasPreviousPage: false },
	)

	async function applyFilters() {
		await pagination.reset({
			q: search.value || undefined,
			author: author.value || undefined,
			adventure: adventure.value === 'all' ? undefined : adventure.value,
			sort: sort.value === LEVEL_SORTS.points ? undefined : sort.value,
			pointsMin: points.value[0] === LEVEL_POINTS_MIN ? undefined : String(points.value[0]),
			pointsMax: points.value[1] === LEVEL_POINTS_MAX ? undefined : String(points.value[1]),
			ratingMin: rating.value[0] === LEVEL_RATING_MIN ? undefined : String(rating.value[0]),
			ratingMax: rating.value[1] === LEVEL_RATING_MAX ? undefined : String(rating.value[1]),
			pb: viewerId.value && personalBest.value !== 'all' ? personalBest.value : undefined,
			wr: viewerId.value && worldRecord.value !== 'all' ? worldRecord.value : undefined,
		})
	}

	return {
		adventure,
		applyFilters,
		author,
		authorSuggestions,
		authorSuggestionsPending: authorSuggestionsResult.fetching,
		levels,
		page,
		pagination,
		personalBest,
		points,
		rating,
		result,
		search,
		sort,
		worldRecord,
	}
}
