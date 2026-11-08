import { useQuery } from '@urql/vue'
import { useWindowFocus } from '@vueuse/core'
import { Zc_TrackTournamentOverallDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type { CursorPage } from '~/types/app'
import type { TrackTournamentType } from '~/types/tournament'
import { pinOverallViewer } from '~/utils/tournamentOverall'

export function useTrackTournamentOverall(
	type: TrackTournamentType,
	viewerId: Ref<number | undefined>,
) {
	const pagination = useCursorPagination(50, 'overall')
	const pageVisible = usePageVisibility()
	const focused = useWindowFocus()
	const result = useQuery({
		query: Zc_TrackTournamentOverallDocument,
		requestPolicy: 'cache-and-network',
		pause: computed(() => import.meta.client && !pageVisible.value),
		variables: computed(() => ({
			type,
			viewerId: viewerId.value ?? 0,
			includeViewer: viewerId.value !== undefined,
			...pagination.variables.value,
		})),
	})
	const standings = computed(() =>
		pinOverallViewer(result.data.value?.standings?.nodes ?? [], result.data.value?.viewer),
	)
	const page = computed<CursorPage>(() => {
		const info = result.data.value?.standings?.pageInfo
		return {
			startCursor: String(info?.startCursor ?? '') || null,
			endCursor: String(info?.endCursor ?? '') || null,
			hasNextPage: info?.hasNextPage ?? false,
			hasPreviousPage: info?.hasPreviousPage ?? false,
		}
	})
	const period = computed(() => result.data.value?.period)
	watch([focused, pageVisible], ([hasFocus, visible]) => {
		if (hasFocus && visible) result.executeQuery({ requestPolicy: 'network-only' })
	})
	async function prefetch() {
		if (import.meta.server) await result
	}
	return { standings, page, period, pagination, result, prefetch }
}
