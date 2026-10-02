import {
	Zc_WorkshopDetailDocument,
	Zc_WorkshopLevelsDocument,
	Zc_WorkshopsDocument,
} from '@zeepkist/graphql/generated'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { useAuthorSuggestions } from '../../app/composables/useAuthorSuggestions'
import { useCursorPagination } from '../../app/composables/useCursorPagination'
import { useLevelWorkshops } from '../../app/composables/useLevelWorkshops'
import { useWorkshopDetail } from '../../app/composables/useWorkshopDetail'
import { useWorkshops } from '../../app/composables/useWorkshops'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@urql/vue', () => ({ useQuery: mocks.query }))

const scopes: ReturnType<typeof effectScope>[] = []
const route = reactive({ query: {} as Record<string, string> })
const active = ref(false)
const push = vi.fn(async ({ query }: { query: Record<string, string> }) => {
	route.query = query
})
const response = () => ({
	data: shallowRef<Record<string, unknown>>(),
	fetching: ref(false),
	error: shallowRef<Error>(),
})
const workshop = {
	workshopId: '123',
	name: 'Pack',
	imageUrl: '',
	authorId: '76561198000000001',
	createdAt: '2026-01-01',
	updatedAt: '2026-10-01',
	fileSize: 10,
}

function withinScope<T>(callback: () => T): T {
	const scope = effectScope()
	scopes.push(scope)
	const result = scope.run(callback)
	if (!result) throw new Error('Missing test scope result')
	return result
}

beforeEach(() => {
	route.query = {}
	active.value = false
	mocks.query.mockImplementation(response)
	for (const [name, value] of Object.entries({
		computed,
		ref,
		shallowRef,
		watch,
		useCursorPagination,
		useAuthorSuggestions,
	}))
		vi.stubGlobal(name, value)
	vi.stubGlobal('useRoute', () => route)
	vi.stubGlobal('useRouter', () => ({ push }))
	vi.stubGlobal('onServerPrefetch', vi.fn())
	vi.stubGlobal('useViewportPrefetch', () => ({ active, target: ref(null) }))
})
afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop()
	vi.unstubAllGlobals()
	vi.clearAllMocks()
	vi.useRealTimers()
})

describe('workshop explorer navigation', () => {
	it('applies filters, resets cursors, preserves unrelated query, and follows browser navigation', async () => {
		route.query = { after: 'old', before: 'older', last: '1', recordsAfter: 'record' }
		const flow = withinScope(useWorkshops)
		flow.search.value = ' Race '
		flow.author.value = ' Racer '
		flow.sort.value = 'UPDATED_AT_DESC'
		await flow.applyFilters()
		expect(route.query).toEqual({
			q: 'Race',
			author: 'Racer',
			sort: 'UPDATED_AT_DESC',
			recordsAfter: 'record',
		})
		await nextTick()
		const options = mocks.query.mock.calls[0]?.[0]
		expect(options.query).toBe(Zc_WorkshopsDocument)
		expect(options.variables.value).toMatchObject({
			first: 24,
			orderBy: ['UPDATED_AT_DESC', 'WORKSHOP_ID_DESC'],
		})
		route.query = { q: 'Earlier search', sort: 'NAME_ASC' }
		await nextTick()
		expect(flow.search.value).toBe('Earlier search')
		expect(flow.author.value).toBe('')
		expect(flow.sort.value).toBe('NAME_ASC')
	})
	it('debounces author suggestions and pauses short input', async () => {
		vi.useFakeTimers()
		const author = ref('R')
		withinScope(() => useAuthorSuggestions(author))
		const options = mocks.query.mock.calls[0]?.[0]
		expect(options.pause.value).toBe(true)
		author.value = 'Racer'
		await nextTick()
		await vi.advanceTimersByTimeAsync(249)
		expect(options.pause.value).toBe(true)
		await vi.advanceTimersByTimeAsync(1)
		expect(options.variables.value).toEqual({ search: 'Racer' })
		expect(options.pause.value).toBe(false)
	})
})

describe('workshop detail and level membership reads', () => {
	it('pauses invalid IDs and does not retain details from previous route', async () => {
		const detail = response()
		detail.data.value = { workshopItem: workshop }
		mocks.query.mockReturnValueOnce(detail).mockReturnValueOnce(response())
		const id = ref('123')
		const flow = withinScope(() => useWorkshopDetail(id, ref(undefined)))
		expect(flow.workshop.value?.workshopId).toBe('123')
		id.value = 'invalid'
		await nextTick()
		expect(flow.workshop.value).toBeNull()
		expect(mocks.query.mock.calls[0]?.[0].pause.value).toBe(true)
		expect(mocks.query.mock.calls[1]?.[0].pause.value).toBe(true)
	})
	it('fetches canonical levels only after workshop exists and includes viewer flags', () => {
		const detail = response()
		detail.data.value = { workshopItem: workshop }
		mocks.query.mockReturnValueOnce(detail).mockReturnValueOnce(response())
		withinScope(() => useWorkshopDetail(ref('123'), ref(7)))
		expect(mocks.query.mock.calls[0]?.[0].query).toBe(Zc_WorkshopDetailDocument)
		const options = mocks.query.mock.calls[1]?.[0]
		expect(options.query).toBe(Zc_WorkshopLevelsDocument)
		expect(options.pause.value).toBe(false)
		expect(options.variables.value).toEqual({
			first: 24,
			workshopId: '123',
			viewerId: 7,
			includeViewer: true,
		})
	})
	it('defers memberships until viewport and keeps record cursors during workshop navigation', async () => {
		route.query = { recordsAfter: 'record-page', pbsAfter: 'pb-page' }
		const flow = withinScope(() => useLevelWorkshops(ref(101)))
		const options = mocks.query.mock.calls[0]?.[0]
		expect(options.pause.value).toBe(true)
		active.value = true
		expect(options.pause.value).toBe(false)
		expect(options.variables.value).toMatchObject({
			first: 24,
			orderBy: ['CREATED_AT_DESC', 'WORKSHOP_ID_DESC'],
			filter: {
				and: [
					{
						levelItems: {
							some: { levelId: { equalTo: 101 }, deleted: { equalTo: false } },
						},
					},
				],
			},
		})
		await flow.pagination.next({
			endCursor: 'workshop-page',
			hasNextPage: true,
			hasPreviousPage: false,
		})
		expect(route.query).toEqual({
			recordsAfter: 'record-page',
			pbsAfter: 'pb-page',
			workshopAfter: 'workshop-page',
		})
		await flow.pagination.first()
		expect(route.query).toEqual({ recordsAfter: 'record-page', pbsAfter: 'pb-page' })
	})
})
