import {
	Zc_LobbyStatisticsDocument,
	Zc_LobbyStatisticsLiveDocument,
} from '@zeepkist/graphql/generated'
import { lobbyStatisticsFilters, normalizeLobbyRange } from '~/utils/lobbyAnalytics'

export function useLobbyStatistics(live = false) {
	const route = useRoute()
	const range = computed(() => normalizeLobbyRange(route.query.range, live))
	const anchor = useState('lobby-window', () => Math.floor(Date.now() / 300_000) * 300_000)
	const variables = computed(() => ({
		...lobbyStatisticsFilters(range.value, anchor.value),
		showRoomDetails: !live,
	}))
	const operation = useLobbyOperation(
		Zc_LobbyStatisticsDocument,
		Zc_LobbyStatisticsLiveDocument,
		variables,
	)
	watch(operation.live.data, () => {
		anchor.value = Math.floor(Date.now() / 300_000) * 300_000
	})
	const visible = usePageVisibility()
	watch(visible, (value) => {
		if (value) anchor.value = Math.floor(Date.now() / 300_000) * 300_000
	})
	return { ...operation, range, anchor }
}
