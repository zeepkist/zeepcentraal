import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref, shallowRef, toValue, watch } from 'vue'
import { useCurrentUser } from '../../app/composables/useCurrentUser'
import { useSuperLeagueRead } from '../../app/composables/useSuperLeagueRead'
import { mergeRequestCookies } from '../../app/utils/requestCookies'

// Model Nuxt's keyed async-data lifecycle, including payload hydration and cancellation.
function setup(
	fetcher = vi.fn(),
	payload?: { owner: string; result: unknown },
	enabled = ref(true),
) {
	const session = reactive({
		user: { id: 1 } as { id: number } | null,
		pending: false,
		resolved: true,
	})
	const round = ref<number | undefined>(50)
	let ready = Promise.resolve()
	let active: AbortController | undefined
	const clear = vi.fn()
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('shallowRef', shallowRef)
	vi.stubGlobal('toValue', toValue)
	vi.stubGlobal('watch', watch)
	vi.stubGlobal('useSessionStore', () => session)
	vi.stubGlobal('$fetch', { raw: fetcher })
	vi.stubGlobal('clearNuxtData', clear)
	vi.stubGlobal(
		'useAsyncData',
		(
			key: { value: string },
			handler: (
				app: object,
				context: { signal: AbortSignal },
			) => Promise<{ owner: string; result: unknown }>,
		) => {
			const data = shallowRef(payload)
			const status = ref(payload ? 'success' : 'idle')
			const error = shallowRef<Error | null>(null)
			async function refresh() {
				active?.abort()
				const controller = new AbortController()
				active = controller
				status.value = 'pending'
				error.value = null
				try {
					const result = await handler({}, { signal: controller.signal })
					if (!controller.signal.aborted) {
						data.value = result
						status.value = 'success'
					}
				} catch (cause) {
					if (!controller.signal.aborted) {
						error.value = cause as Error
						data.value = undefined
						status.value = 'error'
					}
				}
			}
			if (!payload) ready = refresh()
			watch(key, () => {
				data.value = undefined
				ready = refresh()
			})
			return Object.assign(ready, { data, status, error, refresh })
		},
	)
	const scope = effectScope()
	const read = scope.run(() => useSuperLeagueRead<unknown>('vote', round, enabled))
	if (!read) throw new Error('Missing read scope')
	return {
		session,
		round,
		read,
		clear,
		ready: () => ready,
		stop: () => {
			active?.abort()
			scope.stop()
		},
	}
}
const response = (data: unknown) => ({ _data: data, headers: new Headers() })
afterEach(() => vi.unstubAllGlobals())

describe('private contest initial reads', () => {
	it('waits for explicit historical round before reading a private ballot', async () => {
		const enabled = ref(false)
		const fetcher = vi.fn().mockResolvedValue(response({ roundId: 50 }))
		const flow = setup(fetcher, undefined, enabled)
		await flow.ready()
		expect(fetcher).not.toHaveBeenCalled()
		enabled.value = true
		await nextTick()
		await flow.ready()
		expect(fetcher).toHaveBeenCalledWith(
			'/api/super-league/vote',
			expect.objectContaining({ query: { roundId: 50 } }),
		)
		enabled.value = false
		expect(flow.read.data.value).toBeNull()
		flow.stop()
	})
	it('keeps unresolved responses in loading state, including successful empty results', async () => {
		let finish!: (value: unknown) => void
		const fetcher = vi.fn(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const flow = setup(fetcher)
		expect(flow.read.pending.value).toBe(true)
		expect(flow.read.resolved.value).toBe(false)
		finish(response(null))
		await flow.ready()
		expect(flow.read.pending.value).toBe(false)
		expect(flow.read.resolved.value).toBe(true)
		expect(flow.read.data.value).toBeNull()
		flow.stop()
	})
	it('hydrates saved ballots without making another request', async () => {
		const result = { openTypes: [1, 2, 3], votes: [[42], [], []] }
		const fetcher = vi.fn()
		const flow = setup(fetcher, { owner: 'zsl-vote:1:50', result })
		await flow.read.initial
		expect(flow.read.data.value).toEqual(result)
		expect(flow.read.pending.value).toBe(false)
		expect(fetcher).not.toHaveBeenCalled()
		flow.stop()
	})
	it('shows auth loading until session resolves, then performs no guest backend read', async () => {
		const fetcher = vi.fn()
		const flow = setup(fetcher, { owner: 'zsl-vote:guest:50', result: null })
		flow.session.resolved = false
		flow.session.pending = true
		flow.session.user = null
		expect(flow.read.pending.value).toBe(true)
		await nextTick()
		await flow.ready()
		flow.session.resolved = true
		flow.session.pending = false
		expect(flow.read.pending.value).toBe(false)
		expect(flow.read.data.value).toBeNull()
		expect(fetcher).not.toHaveBeenCalled()
		flow.stop()
	})
	it('exposes failures separately from an empty contest and supports retry', async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error('Unavailable'))
			.mockResolvedValueOnce(response({ roundId: 50 }))
		const flow = setup(fetcher)
		await flow.ready()
		expect(flow.read.error.value).toBe('Unavailable')
		expect(flow.read.resolved.value).toBe(false)
		await flow.read.refresh()
		expect(flow.read.error.value).toBeNull()
		expect(flow.read.data.value).toEqual({ roundId: 50 })
		flow.stop()
	})
	it('retains current content during refresh', async () => {
		let finish!: (value: unknown) => void
		const flow = setup(
			vi.fn(
				() =>
					new Promise((resolve) => {
						finish = resolve
					}),
			),
			{ owner: 'zsl-vote:1:50', result: { roundId: 50 } },
		)
		const refresh = flow.read.refresh()
		expect(flow.read.pending.value).toBe(false)
		expect(flow.read.data.value).toEqual({ roundId: 50 })
		finish(response({ roundId: 50, votes: [[1]] }))
		await refresh
		flow.stop()
	})
	it('keeps resolved content when Nuxt clears async data after a failed refresh', async () => {
		const flow = setup(vi.fn().mockRejectedValue(new Error('Unavailable')), {
			owner: 'zsl-vote:1:50',
			result: { roundId: 50, votes: [[42]] },
		})
		await flow.read.refresh()
		expect(flow.read.error.value).toBe('Unavailable')
		expect(flow.read.data.value).toEqual({ roundId: 50, votes: [[42]] })
		expect(flow.read.pending.value).toBe(false)
		flow.session.user = null
		expect(flow.read.data.value).toBeNull()
		flow.stop()
	})
	it('discards private data immediately on logout and isolates the next account', async () => {
		const fetcher = vi.fn().mockResolvedValue(response({ votes: [[99]] }))
		const flow = setup(fetcher, { owner: 'zsl-vote:1:50', result: { votes: [[42]] } })
		flow.session.user = null
		expect(flow.read.data.value).toBeNull()
		expect(flow.clear).toHaveBeenCalledWith('zsl-vote:1:50')
		await nextTick()
		await flow.ready()
		flow.session.user = { id: 2 }
		expect(flow.read.data.value).toBeNull()
		await nextTick()
		await flow.ready()
		expect(flow.read.data.value).toEqual({ votes: [[99]] })
		flow.stop()
	})
	it('ignores delayed round responses after navigation', async () => {
		let finish!: (value: unknown) => void
		const fetcher = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve
					}),
			)
			.mockResolvedValueOnce(response({ roundId: 51 }))
		const flow = setup(fetcher)
		flow.round.value = 51
		await nextTick()
		await flow.ready()
		finish(response({ roundId: 50 }))
		await Promise.resolve()
		expect(flow.read.data.value).toEqual({ roundId: 51 })
		expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
			query: { roundId: 51 },
			credentials: 'include',
		})
		flow.stop()
	})
	it('merges SSR rotation cookies without losing the unchanged tuple or unrelated cookies', () => {
		expect(
			mergeRequestCookies('steam=1; access=old; refresh=old; preference=dark', [
				'access=new; HttpOnly; Path=/',
				'refresh=new; Path=/',
			]),
		).toBe('steam=1; access=new; refresh=new; preference=dark')
	})
})

it('clears all previous viewer contest caches when logout happens on another page', async () => {
	const session = reactive({
		user: { id: 1 } as { id: number } | null,
		resolved: true,
		pending: false,
	})
	const clear = vi.fn()
	vi.stubGlobal('useSessionStore', () => session)
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('watch', watch)
	vi.stubGlobal('useState', (_key: string, initial: () => unknown) => ref(initial()))
	vi.stubGlobal('clearNuxtData', clear)
	const scope = effectScope()
	await scope.run(() => useCurrentUser())
	session.user = null
	const predicate = clear.mock.calls[0]?.[0]
	expect(predicate('zsl-vote:1:50')).toBe(true)
	expect(predicate('zsl-vote:1:51')).toBe(true)
	expect(predicate('zsl-submit-level:1:current')).toBe(true)
	expect(predicate('zsl-vote:2:50')).toBe(false)
	expect(predicate('current-user')).toBe(false)
	scope.stop()
})
