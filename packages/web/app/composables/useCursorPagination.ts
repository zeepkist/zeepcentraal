import type { CursorPage } from '~/types/app'

export type CursorDirection = 'forward' | 'backward'

export function useCursorPagination(pageSize: number) {
	const route = useRoute()
	const router = useRouter()
	const after = computed(() =>
		typeof route.query.after === 'string' ? route.query.after : undefined,
	)
	const before = computed(() =>
		typeof route.query.before === 'string' ? route.query.before : undefined,
	)
	const direction = computed<CursorDirection>(() => (before.value ? 'backward' : 'forward'))
	const variables = computed(() =>
		direction.value === 'backward'
			? { first: undefined, after: undefined, last: pageSize, before: before.value }
			: { first: pageSize, after: after.value, last: undefined, before: undefined },
	)

	async function next(page: CursorPage) {
		if (!page.hasNextPage || !page.endCursor) return
		await router.push({ query: { ...route.query, after: page.endCursor, before: undefined } })
	}

	async function previous(page: CursorPage) {
		if (!page.hasPreviousPage || !page.startCursor) return
		await router.push({ query: { ...route.query, after: undefined, before: page.startCursor } })
	}

	async function reset(extraQuery: Record<string, string | undefined> = {}) {
		await router.push({
			query: { ...route.query, ...extraQuery, after: undefined, before: undefined },
		})
	}

	return { after, before, direction, next, pageSize, previous, reset, variables }
}
