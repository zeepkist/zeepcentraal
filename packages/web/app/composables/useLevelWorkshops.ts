import { useQuery } from '@urql/vue'
import { Zc_WorkshopsDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import {
	buildWorkshopFilter,
	mapWorkshopPage,
	mapWorkshopSummary,
	WORKSHOP_SORTS,
	workshopOrderBy,
} from '~/utils/workshop'

export function useLevelWorkshops(levelId: Ref<number | undefined>) {
	const prefetch = useViewportPrefetch()
	const pagination = useCursorPagination(24, 'workshop')
	const result = useQuery({
		query: Zc_WorkshopsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: buildWorkshopFilter({ levelId: levelId.value ?? 0 }),
			orderBy: workshopOrderBy(WORKSHOP_SORTS.latest),
		})),
		pause: computed(() => levelId.value === undefined || !prefetch.active.value),
	})
	const workshops = computed(() =>
		(result.data.value?.workshopItems?.nodes ?? []).map(mapWorkshopSummary),
	)
	const page = computed(() => mapWorkshopPage(result.data.value?.workshopItems?.pageInfo))
	return { result, workshops, page, pagination, active: prefetch.active, target: prefetch.target }
}
