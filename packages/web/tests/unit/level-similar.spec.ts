import { Zc_SimilarLevelsDocument } from '@zeepkist/graphql/generated'
import { afterEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef } from 'vue'
import { useCursorPagination } from '../../app/composables/useCursorPagination'
import { useLevelSimilar } from '../../app/composables/useLevelSimilar'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@urql/vue', () => ({ useQuery: mocks.query }))

afterEach(() => {
	vi.unstubAllGlobals()
	vi.clearAllMocks()
})

function setup() {
	const route = reactive({ query: { workshopAfter: '23' } as Record<string, string> })
	const active = ref(false)
	const result = {
		data: shallowRef(),
		operation: shallowRef(),
		error: shallowRef(),
		fetching: ref(false),
	}
	mocks.query.mockReturnValue(result)
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('useRoute', () => route)
	vi.stubGlobal('useRouter', () => ({
		push: async ({ query }: { query: Record<string, string> }) => {
			route.query = query
		},
	}))
	vi.stubGlobal('useCursorPagination', useCursorPagination)
	vi.stubGlobal('useViewportPrefetch', () => ({ active, target: ref(null) }))
	const hash = ref('source')
	const viewer = ref<number>()
	const flow = useLevelSimilar(hash, viewer)
	const options = mocks.query.mock.calls[0]?.[0]
	function respond() {
		result.operation.value = { variables: { ...options.variables.value } }
		result.data.value = {
			levels: {
				edges: [9, 2, 7].map((id) => ({
					node: {
						id,
						xxHash: `hash-${id}`,
						adventure: false,
						dateCreated: '2026-01-01',
						levelItems: { nodes: [] },
						levelPoints: null,
						records: { totalCount: 0 },
						personalBestGlobals: { totalCount: 0 },
						votes: { totalCount: 0 },
						viewerFavourites: { totalCount: viewer.value ? 1 : 0 },
						worldRecordGlobal: null,
					},
				})),
				pageInfo: {
					startCursor: '0',
					endCursor: '5',
					hasNextPage: true,
					hasPreviousPage: false,
				},
			},
		}
	}
	return { route, active, result, hash, viewer, flow, options, respond }
}

it('fetches six matches at distance 16, preserves server order, and reacts to viewer and source changes', () => {
	const { active, result, hash, viewer, flow, options, respond } = setup()
	expect(options.query).toBe(Zc_SimilarLevelsDocument)
	expect(options.pause.value).toBe(true)
	active.value = true
	expect(options.pause.value).toBe(false)
	expect(options.variables.value).toEqual({
		first: 6,
		xxHash: 'source',
		maxDistance: 16,
		viewerId: 0,
		includeViewer: false,
	})
	expect(flow.pending.value).toBe(true)
	respond()
	expect(flow.levels.value.map((level) => level.id)).toEqual([9, 2, 7])
	expect(flow.pending.value).toBe(false)
	viewer.value = 42
	expect(flow.levels.value).toEqual([])
	expect(options.variables.value).toMatchObject({ viewerId: 42, includeViewer: true })
	respond()
	expect(flow.levels.value.every((level) => level.favourited)).toBe(true)
	hash.value = 'other-source'
	expect(flow.levels.value).toEqual([])
	expect(flow.pending.value).toBe(true)
	respond()
	result.error.value = new Error('Similarity unavailable')
	expect(flow.error.value).toBe('Similarity unavailable')
	result.data.value = {
		levels: { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } },
	}
	expect(flow.levels.value).toEqual([])
	expect(flow.page.value.hasNextPage).toBe(false)
})

it('supports all cursor directions while preserving unrelated query parameters', async () => {
	const { flow, route, options, respond } = setup()
	respond()
	await flow.pagination.next(flow.page.value)
	expect(route.query).toEqual({ workshopAfter: '23', similarAfter: '5' })
	expect(options.variables.value).toMatchObject({ first: 6, after: '5' })
	await flow.pagination.previous({
		startCursor: '6',
		endCursor: '11',
		hasNextPage: true,
		hasPreviousPage: true,
	})
	expect(route.query).toEqual({ workshopAfter: '23', similarBefore: '6' })
	expect(options.variables.value).toMatchObject({ last: 6, before: '6' })
	await flow.pagination.last()
	expect(route.query).toEqual({ workshopAfter: '23', similarLast: '1' })
	expect(options.variables.value).toMatchObject({ last: 6 })
	await flow.pagination.first()
	expect(route.query).toEqual({ workshopAfter: '23' })
	expect(options.variables.value).toMatchObject({ first: 6 })
})
