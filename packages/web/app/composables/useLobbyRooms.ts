import { Zc_LobbyRoomsDocument, Zc_LobbyRoomsLiveDocument } from '@zeepkist/graphql/generated'
import { buildLobbyFilter, lobbyOrderBy, mapLobbyPage, mapLobbyRoom } from '~/utils/lobbyAnalytics'

export function useLobbyRooms(history = false) {
	const route = useRoute()
	const pagination = useCursorPagination(25)
	const variables = computed(() => ({
		...pagination.variables.value,
		filter: buildLobbyFilter(route.query, history),
		orderBy: lobbyOrderBy(
			typeof route.query.sort === 'string'
				? route.query.sort
				: history
					? 'closed'
					: 'players',
		),
	}))
	const operation = useLobbyOperation(Zc_LobbyRoomsDocument, Zc_LobbyRoomsLiveDocument, variables)
	const rooms = computed(() => operation.data.value?.lobbyListings?.nodes.map(mapLobbyRoom) ?? [])
	const page = computed(() => mapLobbyPage(operation.data.value?.lobbyListings?.pageInfo))
	return { ...operation, rooms, page, pagination }
}
