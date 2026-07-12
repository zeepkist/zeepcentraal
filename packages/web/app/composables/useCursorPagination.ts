import type { CursorPage } from '~/types/app'

export type CursorDirection = 'forward' | 'backward' | 'last'
export type CursorQuery = Record<string, string | (string | null)[] | null | undefined>

export type CursorKeys = {
	after: string
	before: string
	last: string
}

export function getCursorVariables(
	pageSize: number,
	after?: string,
	before?: string,
	lastPage = false,
) {
	if (lastPage) return { last: pageSize }
	if (before) return { last: pageSize, before }
	return after ? { first: pageSize, after } : { first: pageSize }
}

export function replaceCursorQuery(
	query: CursorQuery,
	keys: CursorKeys,
	replacement: Record<string, string | undefined> = {},
): CursorQuery {
	const next = { ...query }
	delete next[keys.after]
	delete next[keys.before]
	delete next[keys.last]

	for (const [key, value] of Object.entries(replacement)) {
		if (value === undefined) delete next[key]
		else next[key] = value
	}

	return next
}

export function canNavigatePrevious(
	direction: CursorDirection,
	after: string | undefined,
	page: CursorPage,
) {
	return direction === 'forward' ? after !== undefined : page.hasPreviousPage
}

export function canNavigateNext(
	direction: CursorDirection,
	before: string | undefined,
	page: CursorPage,
) {
	if (direction === 'backward') return before !== undefined
	if (direction === 'last') return false
	return page.hasNextPage
}

export function isFirstCursorPage(after?: string, before?: string, lastPage = false) {
	return after === undefined && before === undefined && !lastPage
}

export function isInitialPagePending(fetching: boolean, itemCount: number, active = true) {
	return !active || (fetching && itemCount === 0)
}

export function useCursorPagination(pageSize: number, namespace = '') {
	const route = useRoute()
	const router = useRouter()
	const afterKey = namespace ? `${namespace}After` : 'after'
	const beforeKey = namespace ? `${namespace}Before` : 'before'
	const lastKey = namespace ? `${namespace}Last` : 'last'
	const keys = { after: afterKey, before: beforeKey, last: lastKey }
	const after = computed(() =>
		typeof route.query[afterKey] === 'string' ? route.query[afterKey] : undefined,
	)
	const before = computed(() =>
		typeof route.query[beforeKey] === 'string' ? route.query[beforeKey] : undefined,
	)
	const isLastPage = computed(() => route.query[lastKey] === '1')
	const direction = computed<CursorDirection>(() =>
		isLastPage.value ? 'last' : before.value ? 'backward' : 'forward',
	)
	const variables = computed(() =>
		getCursorVariables(pageSize, after.value, before.value, isLastPage.value),
	)
	const isFirstPage = computed(() =>
		isFirstCursorPage(after.value, before.value, isLastPage.value),
	)

	function paginationQuery(replacement: Record<string, string | undefined> = {}) {
		return replaceCursorQuery({ ...route.query }, keys, replacement)
	}

	function canGoPrevious(page: CursorPage) {
		return canNavigatePrevious(direction.value, after.value, page)
	}

	function canGoNext(page: CursorPage) {
		return canNavigateNext(direction.value, before.value, page)
	}

	async function first() {
		await router.push({ query: paginationQuery() })
	}

	async function last() {
		await router.push({ query: paginationQuery({ [lastKey]: '1' }) })
	}

	async function next(page: CursorPage) {
		if (!canGoNext(page) || !page.endCursor) return
		await router.push({ query: paginationQuery({ [afterKey]: page.endCursor }) })
	}

	async function previous(page: CursorPage) {
		if (!canGoPrevious(page) || !page.startCursor) return
		await router.push({ query: paginationQuery({ [beforeKey]: page.startCursor }) })
	}

	async function reset(extraQuery: Record<string, string | undefined> = {}) {
		await router.push({ query: paginationQuery(extraQuery) })
	}

	return {
		after,
		before,
		canGoNext,
		canGoPrevious,
		direction,
		first,
		isInitialPending: isInitialPagePending,
		isFirstPage,
		isLastPage,
		last,
		next,
		pageSize,
		previous,
		reset,
		variables,
	}
}
