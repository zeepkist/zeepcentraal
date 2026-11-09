import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, shallowRef } from 'vue'
import { useLobbyOperation } from '../../app/composables/useLobbyOperation'

const mocks = vi.hoisted(() => ({ query: vi.fn(), subscription: vi.fn() }))
vi.mock('@urql/vue', () => ({ useQuery: mocks.query, useSubscription: mocks.subscription }))
afterEach(() => {
	vi.unstubAllGlobals()
	vi.clearAllMocks()
})

describe('lobby subscription lifecycle', () => {
	it('retains SSR seed, pauses hidden subscriptions, isolates changed filters, and keeps data during disconnect', async () => {
		const visible = shallowRef(true),
			transport = shallowRef('connected'),
			variables = shallowRef({ id: '1' })
		const mounted: Array<() => void> = []
		const seed = {
			data: shallowRef({ players: 2 }),
			operation: shallowRef({ variables: { id: '1' } }),
			error: shallowRef(undefined),
			fetching: shallowRef(false),
		}
		const live = {
			data: shallowRef<{ key: string; data: { players: number } }>(),
			error: shallowRef<Error | undefined>(undefined),
			fetching: shallowRef(true),
		}
		mocks.query.mockReturnValue(seed)
		mocks.subscription.mockReturnValue(live)
		vi.stubGlobal('computed', computed)
		vi.stubGlobal('shallowRef', shallowRef)
		vi.stubGlobal('useState', () => transport)
		vi.stubGlobal('usePageVisibility', () => visible)
		vi.stubGlobal('onMounted', (callback: () => void) => mounted.push(callback))
		vi.stubGlobal('onServerPrefetch', vi.fn())
		const operation = useLobbyOperation(
			{} as TypedDocumentNode<{ players: number }, { id: string }>,
			{} as TypedDocumentNode<{ query: { players: number } }, { id: string }>,
			variables,
		)
		expect(operation.data.value).toEqual({ players: 2 })
		mounted.forEach((callback) => {
			callback()
		})
		const call = mocks.subscription.mock.calls[0]
		expect(call).toBeDefined()
		if (!call) throw new Error('Subscription not registered')
		const [options, receive] = call
		expect(options.pause.value).toBe(false)
		visible.value = false
		expect(options.pause.value).toBe(true)
		visible.value = true
		live.data.value = receive(undefined, { query: { players: 5 } })
		await nextTick()
		expect(operation.data.value).toEqual({ players: 5 })
		live.data.value = receive(undefined, { query: { players: 999 } })
		live.error.value = new Error('Partial GraphQL response')
		await nextTick()
		expect(operation.data.value).toEqual({ players: 5 })
		transport.value = 'disconnected'
		expect(operation.connecting.value).toBe(true)
		expect(operation.data.value).toEqual({ players: 5 })
		variables.value = { id: '2' }
		expect(operation.data.value).toBeUndefined()
		seed.operation.value = { variables: { id: '2' } }
		seed.data.value = { players: 8 }
		await nextTick()
		expect(operation.data.value).toEqual({ players: 8 })
	})
})
