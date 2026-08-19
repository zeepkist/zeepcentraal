import { useQuery } from '@urql/vue'
import { Zc_UserFavouriteLevelsDocument } from '@zeepkist/graphql/generated'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { mapUserLevel } from '~/composables/useUserLevels'
import type { CursorPage, LevelSummary } from '~/types/app'

export function useUserFavouriteLevels(
	userId: Ref<number | undefined>,
	viewerId: Ref<number | undefined>,
	active: MaybeRefOrGetter<boolean>,
) {
	const pagination = useCursorPagination(24, 'favourites')
	const favouriteState = useLevelFavouriteState()
	const favouritesQuery = useQuery({
		query: Zc_UserFavouriteLevelsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			userId: userId.value ?? 0,
			viewerId: viewerId.value ?? 0,
			includeViewer: viewerId.value !== undefined,
		})),
		pause: computed(() => import.meta.server || userId.value === undefined || !toValue(active)),
	})
	const connection = computed(() => favouritesQuery.data.value?.user?.favourites)
	const queriedLevels = computed<LevelSummary[]>(() =>
		(connection.value?.edges ?? []).flatMap(({ node }) =>
			node.level ? [mapUserLevel(node.level)] : [],
		),
	)
	const favouriteLevels = computed(() => {
		if (userId.value === undefined || userId.value !== viewerId.value)
			return queriedLevels.value
		return queriedLevels.value.filter((level) =>
			favouriteState.isFavourited({ ...level, userId: userId.value as number }),
		)
	})
	const favouritesPage = computed<CursorPage>(() =>
		connection.value?.pageInfo
			? {
					startCursor: String(connection.value.pageInfo.startCursor ?? '') || null,
					endCursor: String(connection.value.pageInfo.endCursor ?? '') || null,
					hasNextPage: connection.value.pageInfo.hasNextPage,
					hasPreviousPage: connection.value.pageInfo.hasPreviousPage,
				}
			: { hasNextPage: false, hasPreviousPage: false },
	)

	watch(favouriteState.revision, () => {
		if (userId.value !== viewerId.value || !toValue(active)) return
		favouritesQuery.executeQuery({ requestPolicy: 'network-only' })
	})

	return {
		favouriteLevels,
		favouritesPage,
		favouritesPagination: pagination,
		favouritesQuery,
	}
}
