import type { CursorPage } from '~/types/app'
import { MOD_SORTS, type ModListResponse, type ModSort } from '~/types/mod'
import { normalizeModPage, normalizeModSearch, normalizeModSort } from '~/utils/modExplorer'

export async function useMods() {
	const route = useRoute()
	const router = useRouter()
	const appliedSearch = computed(() => normalizeModSearch(route.query.q))
	const appliedSort = computed(() => normalizeModSort(route.query.sort))
	const appliedPage = computed(() => normalizeModPage(route.query.page))
	const search = ref(appliedSearch.value)
	const sort = ref<ModSort>(appliedSort.value)

	watch([appliedSearch, appliedSort], ([nextSearch, nextSort]) => {
		search.value = nextSearch
		sort.value = nextSort
	})

	const request = await useFetch<ModListResponse>('/api/modio/mods', {
		query: computed(() => ({
			q: appliedSearch.value || undefined,
			sort: appliedSort.value === MOD_SORTS.popular ? undefined : appliedSort.value,
			page: appliedPage.value === 1 ? undefined : appliedPage.value,
		})),
		key: 'mod-explorer',
	})
	const retained = shallowRef<ModListResponse | null>(request.data.value ?? null)
	watch(request.data, (value) => {
		if (value) retained.value = value
	})

	const pending = computed(() => request.status.value === 'pending')
	const page = computed<CursorPage>(() => ({
		hasPreviousPage: appliedPage.value > 1,
		hasNextPage: appliedPage.value < (retained.value?.totalPages ?? 1),
	}))

	async function setPage(nextPage: number) {
		await router.push({
			query: {
				...route.query,
				page: nextPage <= 1 ? undefined : String(nextPage),
			},
		})
	}

	async function applyFilters() {
		await router.push({
			query: {
				q: normalizeModSearch(search.value) || undefined,
				sort: sort.value === MOD_SORTS.popular ? undefined : sort.value,
			},
		})
	}

	return {
		applyFilters,
		data: readonly(retained),
		error: computed(() => request.error.value?.message ?? null),
		first: () => setPage(1),
		last: () => setPage(retained.value?.totalPages ?? 1),
		next: () => setPage(Math.min(appliedPage.value + 1, retained.value?.totalPages ?? 1)),
		page,
		pageNumber: appliedPage,
		pending,
		previous: () => setPage(Math.max(1, appliedPage.value - 1)),
		search,
		sort,
	}
}
