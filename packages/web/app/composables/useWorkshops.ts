import { useQuery } from '@urql/vue'
import { Zc_WorkshopsDocument } from '@zeepkist/graphql/generated'
import {
	buildWorkshopFilter,
	mapWorkshopPage,
	mapWorkshopSummary,
	normalizeWorkshopSort,
	WORKSHOP_SORTS,
	workshopOrderBy,
} from '~/utils/workshop'

export function useWorkshops() {
	const route = useRoute()
	const pagination = useCursorPagination(24)
	const appliedSearch = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
	const appliedAuthor = computed(() =>
		typeof route.query.author === 'string' ? route.query.author : '',
	)
	const appliedSort = computed(() => normalizeWorkshopSort(route.query.sort))
	const search = shallowRef(appliedSearch.value)
	const author = shallowRef(appliedAuthor.value)
	const sort = shallowRef(appliedSort.value)
	watch([appliedSearch, appliedAuthor, appliedSort], ([nextSearch, nextAuthor, nextSort]) => {
		search.value = nextSearch
		author.value = nextAuthor
		sort.value = nextSort
	})
	const result = useQuery({
		query: Zc_WorkshopsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: buildWorkshopFilter({
				search: appliedSearch.value,
				author: appliedAuthor.value,
			}),
			orderBy: workshopOrderBy(appliedSort.value),
		})),
	})
	const workshops = computed(() =>
		(result.data.value?.workshopItems?.nodes ?? []).map(mapWorkshopSummary),
	)
	const page = computed(() => mapWorkshopPage(result.data.value?.workshopItems?.pageInfo))
	const authorSuggestions = useAuthorSuggestions(author)
	onServerPrefetch(async () => {
		await result
	})
	async function applyFilters() {
		await pagination.reset({
			q: search.value.trim() || undefined,
			author: author.value.trim() || undefined,
			sort: sort.value === WORKSHOP_SORTS.latest ? undefined : sort.value,
		})
	}
	return {
		search,
		author,
		sort,
		result,
		workshops,
		page,
		pagination,
		authorSuggestions,
		applyFilters,
	}
}
