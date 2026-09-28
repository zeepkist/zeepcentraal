import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref, shallowRef, toValue, watch } from 'vue'
import { useSuperLeagueSubmission } from '../../app/composables/useSuperLeagueSubmission'
import type { LevelSubmission } from '../../app/utils/superLeagueSubmission'

const queued: LevelSubmission = {
	id: 42,
	roundId: 50,
	workshopId: '123',
	authors: ['76561198000000001'],
	authorNames: ['Builder'],
	revision: 1,
	status: 'queued',
	validation: null,
}
function setup(fetcher: ReturnType<typeof vi.fn>) {
	vi.useFakeTimers()
	const session = reactive({ user: { id: 1 } as { id: number } | null })
	vi.stubGlobal('useRuntimeConfig', () => ({ public: { backendUrl: 'https://api.example.com' } }))
	vi.stubGlobal('useSessionStore', () => session)
	vi.stubGlobal('$fetch', fetcher)
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('useSuperLeagueRead', () => {
		const data = shallowRef(null)
		return {
			data,
			pending: ref(false),
			resolved: ref(true),
			error: ref(null),
			initial: Promise.resolve(),
			refresh: async () => {
				data.value = session.user ? await fetcher('/api/super-league/submit-level') : null
			},
		}
	})
	vi.stubGlobal('ref', ref)
	vi.stubGlobal('shallowRef', shallowRef)
	vi.stubGlobal('toValue', toValue)
	vi.stubGlobal('watch', watch)
	vi.stubGlobal('onMounted', () => {})
	let dispose: () => void = () => {}
	vi.stubGlobal('onScopeDispose', (callback: () => void) => {
		dispose = callback
	})
	const scope = effectScope()
	const flow = scope.run(() => useSuperLeagueSubmission(50))
	if (!flow) throw new Error('Missing submission test scope')
	return {
		session,
		flow,
		stop: () => {
			dispose()
			scope.stop()
		},
	}
}
afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})
describe('submission polling lifecycle', () => {
	it('polls retries every two seconds and stops at complete', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce({ contest: { roundId: 50 }, submission: queued })
			.mockResolvedValueOnce({ ...queued, status: 'retrying' })
			.mockResolvedValueOnce({ ...queued, status: 'complete', validation: { valid: true } })
		const { flow, stop } = setup(fetcher)
		await flow.refresh()
		await vi.advanceTimersByTimeAsync(2000)
		expect(flow.submission.value?.status).toBe('retrying')
		await vi.advanceTimersByTimeAsync(2000)
		expect(flow.submission.value?.status).toBe('complete')
		await vi.advanceTimersByTimeAsync(10000)
		expect(fetcher).toHaveBeenCalledTimes(3)
		stop()
	})
	it('clears shared submission and stops polling on logout', async () => {
		const fetcher = vi.fn().mockResolvedValue({ contest: { roundId: 50 }, submission: queued })
		const { flow, session, stop } = setup(fetcher)
		await flow.refresh()
		session.user = null
		await nextTick()
		await vi.advanceTimersByTimeAsync(10000)
		expect(flow.submission.value).toBeNull()
		expect(fetcher).toHaveBeenCalledTimes(1)
		stop()
	})
	it('ignores a status reply after navigation and schedules no new poll', async () => {
		let resolve: (value: LevelSubmission) => void = () => {}
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce({ contest: { roundId: 50 }, submission: queued })
			.mockImplementationOnce(
				() =>
					new Promise<LevelSubmission>((done) => {
						resolve = done
					}),
			)
		const { flow, stop } = setup(fetcher)
		await flow.refresh()
		await vi.advanceTimersByTimeAsync(2000)
		stop()
		resolve({ ...queued, status: 'complete' })
		await Promise.resolve()
		await vi.advanceTimersByTimeAsync(10000)
		expect(flow.submission.value?.status).toBe('queued')
		expect(fetcher).toHaveBeenCalledTimes(2)
	})
})
