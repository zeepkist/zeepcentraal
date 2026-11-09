import {
	Zc_LobbyStatisticsDocument,
	Zc_LobbyStatisticsLiveDocument,
} from '@zeepkist/graphql/generated'
import { lobbyStatisticsFilters, normalizeLobbyRange } from '~/utils/lobbyAnalytics'

export function useLobbyStatistics(live = false) {
	const route = useRoute()
	const range = computed(() => {
		const selected = normalizeLobbyRange(route.query.range)
		return live && !['24h', '7d', '30d'].includes(selected) ? '24h' : selected
	})
	const peak = computed(() =>
		typeof route.query.peak === 'string' &&
		['today', '7d', '30d', '90d', 'all'].includes(route.query.peak)
			? route.query.peak
			: 'all',
	)
	const anchor = useState('lobby-window', () => Math.floor(Date.now() / 300_000) * 300_000)
	const variables = computed(() => lobbyStatisticsFilters(range.value, peak.value, anchor.value))
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
	return { ...operation, range, peak, anchor }
}
