import { useQuery, useSubscription } from '@urql/vue'
import {
	Zc_AdventureLeaderboardDocument,
	Zc_AdventureLeaderboardLiveDocument,
} from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type { CursorPage } from '~/types/app'

export function useAdventureLeaderboard(
	series: Ref<string | undefined>,
	viewerId: Ref<number | undefined>,
) {
	const pagination = useCursorPagination(50, 'adventure')
	const mounted = shallowRef(false)
	const pageVisible = usePageVisibility()
	const variables = computed(() => ({
		series: series.value ?? null,
		viewerId: viewerId.value ?? 0,
		includeViewer: viewerId.value !== undefined,
		...pagination.variables.value,
	}))
	const result = useQuery({
		query: Zc_AdventureLeaderboardDocument,
		variables,
		requestPolicy: 'cache-and-network',
	})
	const operationKey = computed(() => JSON.stringify(variables.value))
	const lastLive = shallowRef<{ key: string; signature: string }>()
	const live = useSubscription(
		{
			query: Zc_AdventureLeaderboardLiveDocument,
			variables,
			pause: computed(() => import.meta.server || !mounted.value || !pageVisible.value),
		},
		(_previous, data) => {
			const key = operationKey.value
			const signature = JSON.stringify(
				data.adventureLeaderboard?.entries.edges.map(({ node }) => [
					node.userId,
					node.rank,
					node.completedLevels,
					node.totalTimeMs,
				]),
			)
			if (
				lastLive.value?.key === key &&
				lastLive.value.signature !== signature &&
				!pagination.isFirstPage.value
			)
				void pagination.reset()
			lastLive.value = { key, signature }
			return data
		},
	)
	const scope = computed(() => {
		if (lastLive.value?.key === operationKey.value) return live.data.value?.adventureLeaderboard
		if (JSON.stringify(result.operation.value?.variables) === operationKey.value)
			return result.data.value?.adventureLeaderboard
		return undefined
	})
	const entries = computed(() => scope.value?.entries.edges.map((edge) => edge.node) ?? [])
	const page = computed<CursorPage>(() => {
		const info = scope.value?.entries.pageInfo
		return {
			startCursor: String(info?.startCursor ?? '') || null,
			endCursor: String(info?.endCursor ?? '') || null,
			hasNextPage: info?.hasNextPage ?? false,
			hasPreviousPage: info?.hasPreviousPage ?? false,
		}
	})
	watch(series, () => {
		if (!pagination.isFirstPage.value) void pagination.reset()
	})
	onMounted(() => {
		mounted.value = true
	})
	watch(pageVisible, (value) => {
		if (value) result.executeQuery({ requestPolicy: 'network-only' })
	})
	async function prefetch() {
		if (import.meta.server) await result
	}
	return { scope, entries, page, pagination, result, live, prefetch }
}
