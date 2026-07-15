import type { CursorPage, SortOption } from '~/types/app'
import {
	MOD_SORTS,
	type ModListResponse,
	type ModSort,
	type ModTagOptionsResponse,
} from '~/types/mod'
import {
	normalizeEssentialsOnly,
	normalizeModPage,
	normalizeModSearch,
	normalizeModSort,
	normalizeModTags,
} from '~/utils/modExplorer'

export async function useMods() {
	const route = useRoute()
	const router = useRouter()
	const appliedSearch = computed(() => normalizeModSearch(route.query.q))
	const appliedSort = computed(() => normalizeModSort(route.query.sort))
	const appliedPage = computed(() => normalizeModPage(route.query.page))
	const appliedEssentialsOnly = computed(() => normalizeEssentialsOnly(route.query.essential))
	const appliedTags = computed(() => normalizeModTags(route.query.tags))
	const search = ref(appliedSearch.value)
	const sort = ref<ModSort>(appliedSort.value)
	const essentialsOnly = ref(appliedEssentialsOnly.value)
	const tags = ref([...appliedTags.value])

	watch(
		[appliedSearch, appliedSort, appliedEssentialsOnly, appliedTags],
		([nextSearch, nextSort, nextEssential, nextTags]) => {
			search.value = nextSearch
			sort.value = nextSort
			essentialsOnly.value = nextEssential
			tags.value = [...nextTags]
		},
	)

	const requestPromise = useFetch<ModListResponse>('/api/modio/mods', {
		query: computed(() => ({
			q: appliedSearch.value || undefined,
			sort: appliedSort.value === MOD_SORTS.popular ? undefined : appliedSort.value,
			page: appliedPage.value === 1 ? undefined : appliedPage.value,
			essential: appliedEssentialsOnly.value ? '1' : undefined,
			tags: appliedTags.value.length ? appliedTags.value.join(',') : undefined,
		})),
		key: 'mod-explorer',
	})
	const tagOptionsPromise = useFetch<ModTagOptionsResponse>('/api/modio/tags', {
		key: 'mod-tag-options',
	})
	const [request, tagOptionsRequest] = await Promise.all([requestPromise, tagOptionsPromise])
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
				essential: essentialsOnly.value ? '1' : undefined,
				tags: tags.value.length ? normalizeModTags(tags.value).join(',') : undefined,
			},
		})
	}

	return {
		applyFilters,
		data: readonly(retained),
		error: computed(() => request.error.value?.message ?? null),
		essentialsOnly,
		first: () => setPage(1),
		last: () => setPage(retained.value?.totalPages ?? 1),
		next: () => setPage(Math.min(appliedPage.value + 1, retained.value?.totalPages ?? 1)),
		page,
		pageNumber: appliedPage,
		pending,
		previous: () => setPage(Math.max(1, appliedPage.value - 1)),
		search,
		sort,
		tagOptions: computed<SortOption[]>(() =>
			(tagOptionsRequest.data.value?.tags ?? []).map((tag) => ({ label: tag, value: tag })),
		),
		tagOptionsPending: computed(() => tagOptionsRequest.status.value === 'pending'),
		tags,
	}
}
