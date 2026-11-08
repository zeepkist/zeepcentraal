import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, shallowRef, watch } from 'vue'

const client = vi.hoisted(() => ({ query: vi.fn(), subscription: vi.fn() }))
vi.mock('@urql/vue', () => ({ useClientHandle: () => ({ client }) }))

import { useAdventurePlayerLevels } from '../../app/composables/useAdventurePlayerLevels'

afterEach(() => {
	vi.unstubAllGlobals()
	vi.clearAllMocks()
})

function setup() {
	const visible = shallowRef(true)
	let mount: () => void = () => {}
	let unmount: () => void = () => {}
	for (const [name, value] of Object.entries({
		computed,
		shallowRef,
		watch,
		usePageVisibility: () => visible,
		onMounted: (callback: () => void) => {
			mount = callback
		},
		onBeforeUnmount: (callback: () => void) => {
			unmount = callback
		},
	}))
		vi.stubGlobal(name, value)
	const scope = effectScope()
	const result = scope.run(() => useAdventurePlayerLevels(shallowRef(undefined), shallowRef(65)))
	if (!result) throw new Error('Missing detail scope')
	return {
		result,
		visible,
		mount: () => mount(),
		close: () => {
			unmount()
			scope.stop()
		},
	}
}

const node = (id: number, time = 12) => ({
	series: 'a',
	levelId: id,
	levelItem: {
		id,
		name: `A-${String(id).padStart(2, '0')}`,
		fileUid: `uid-${id}`,
		fileAuthor: 'Author',
		workshopId: '123',
	},
	level: {
		id,
		xxHash: String(id).padStart(32, '0'),
		personalBestGlobals: { nodes: [{ record: { id, time } }] },
		worldRecordGlobal: { record: { id: id + 100, time: 10 } },
	},
})
const page = (id: number, next: boolean, time = 12) => ({
	data: {
		adventureLevelMemberships: {
			nodes: [node(id, time)],
			pageInfo: { hasNextPage: next, endCursor: next ? 'next' : 'end' },
		},
	},
})

describe('lazy Adventure result loading', () => {
	it('collects all pages only after expansion, updates live times and disposes hidden/collapsed subscriptions', async () => {
		client.query.mockImplementation((_document, variables) => ({
			toPromise: async () => page(variables.after ? 2 : 1, !variables.after),
		}))
		const handlers: Array<(result: unknown) => void> = []
		const unsubscribe = vi.fn()
		client.subscription.mockReturnValue({
			subscribe: (callback: (result: unknown) => void) => {
				handlers.push(callback)
				return { unsubscribe }
			},
		})
		const state = setup()
		try {
			expect(client.query).not.toHaveBeenCalled()
			state.mount()
			await vi.waitFor(() => expect(state.result.levels.value).toHaveLength(2))
			expect(client.query.mock.calls[1]?.[1].after).toBe('next')
			expect(handlers).toHaveLength(2)
			handlers[1]?.(page(2, false, 11))
			expect(state.result.levels.value[1]?.delta).toBe(1000)
			state.visible.value = false
			await nextTick()
			expect(unsubscribe).toHaveBeenCalledTimes(2)
			state.visible.value = true
			await vi.waitFor(() => expect(client.query).toHaveBeenCalledTimes(4))
			await vi.waitFor(() => expect(handlers).toHaveLength(4))
		} finally {
			state.close()
		}
		expect(unsubscribe).toHaveBeenCalledTimes(4)
	})
	it('rejects repeated cursors instead of looping or returning truncated results', async () => {
		client.query.mockReturnValue({ toPromise: async () => page(1, true) })
		const state = setup()
		try {
			state.mount()
			await vi.waitFor(() =>
				expect(state.result.error.value).toBe('Invalid Adventure level cursor'),
			)
			expect(state.result.pending.value).toBe(false)
			expect(state.result.levels.value).toEqual([])
			expect(client.subscription).not.toHaveBeenCalled()
		} finally {
			state.close()
		}
	})
})
