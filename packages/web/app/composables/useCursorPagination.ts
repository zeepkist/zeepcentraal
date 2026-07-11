import type { CursorPage } from '~/types/app'

export type CursorDirection = 'forward' | 'backward'

export function useCursorPagination(pageSize: number, namespace = '') {
	const route = useRoute()
	const router = useRouter()
	const afterKey = namespace ? `${namespace}After` : 'after'
	const beforeKey = namespace ? `${namespace}Before` : 'before'
	const after = computed(() =>
		typeof route.query[afterKey] === 'string' ? route.query[afterKey] : undefined,
	)
	const before = computed(() =>
		typeof route.query[beforeKey] === 'string' ? route.query[beforeKey] : undefined,
	)
	const direction = computed<CursorDirection>(() => (before.value ? 'backward' : 'forward'))
	const variables = computed(() =>
		direction.value === 'backward'
			? { first: undefined, after: undefined, last: pageSize, before: before.value }
			: { first: pageSize, after: after.value, last: undefined, before: undefined },
	)

	async function next(page: CursorPage) {
		if (!page.hasNextPage || !page.endCursor) return
		await router.push({
			query: { ...route.query, [afterKey]: page.endCursor, [beforeKey]: undefined },
		})
	}

	async function previous(page: CursorPage) {
		if (!page.hasPreviousPage || !page.startCursor) return
		await router.push({
			query: { ...route.query, [afterKey]: undefined, [beforeKey]: page.startCursor },
		})
	}

	async function reset(extraQuery: Record<string, string | undefined> = {}) {
		await router.push({
			query: {
				...route.query,
				...extraQuery,
				[afterKey]: undefined,
				[beforeKey]: undefined,
			},
		})
	}

	return { after, before, direction, next, pageSize, previous, reset, variables }
}
