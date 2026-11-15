import { useQuery } from '@urql/vue'
import { Zc_SimilarLevelsDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import { mapLevelSummary } from '~/utils/levelSummary'
import { mapWorkshopPage } from '~/utils/workshop'

export function useLevelSimilar(xxHash: Ref<string>, viewerId: Ref<number | undefined>) {
	const prefetch = useViewportPrefetch()
	const pagination = useCursorPagination(6, 'similar')
	const variables = computed(() => ({
		...pagination.variables.value,
		xxHash: xxHash.value,
		maxDistance: 16,
		viewerId: viewerId.value ?? 0,
		includeViewer: viewerId.value !== undefined,
	}))
	const result = useQuery({
		query: Zc_SimilarLevelsDocument,
		variables,
		pause: computed(() => !xxHash.value || !prefetch.active.value),
	})
	const current = computed(
		() => JSON.stringify(result.operation.value?.variables) === JSON.stringify(variables.value),
	)
	const connection = computed(() => (current.value ? result.data.value?.levels : undefined))
	const levels = computed(() =>
		(connection.value?.edges ?? []).map(({ node }) => mapLevelSummary(node)),
	)
	const page = computed(() => mapWorkshopPage(connection.value?.pageInfo))
	const error = computed(() => (current.value ? result.error.value?.message : undefined))
	const pending = computed(
		() => !prefetch.active.value || !current.value || result.fetching.value,
	)
	return { levels, page, pagination, error, pending, target: prefetch.target }
}
