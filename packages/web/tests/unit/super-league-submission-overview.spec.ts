import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, ref, shallowRef, toValue, watch } from 'vue'
import { useSuperLeagueSubmissionOverview } from '../../app/composables/useSuperLeagueSubmissionOverview'
import type { SubmissionOverview } from '../../app/utils/superLeagueSubmission'

function setup() {
	const data = shallowRef<{ owner: string; result: SubmissionOverview }>()
	const status = ref('idle')
	const error = ref<Error | null>(null)
	const round = ref<number | undefined>(50)
	const fetcher = vi
		.fn()
		.mockResolvedValue({ contest: null, validCount: 0, totalCount: 0, submissions: [] })
	let handler: (_app: object, context: { signal: AbortSignal }) => Promise<unknown> = async () =>
		undefined
	for (const [name, value] of Object.entries({ computed, shallowRef, toValue, watch }))
		vi.stubGlobal(name, value)
	vi.stubGlobal('$fetch', fetcher)
	vi.stubGlobal('useAsyncData', (_identity: unknown, next: typeof handler) => {
		handler = next
		return { data, status, error, refresh: vi.fn() }
	})
	const scope = effectScope()
	const flow = scope.run(() => useSuperLeagueSubmissionOverview(round))
	if (!flow) throw new Error('Missing overview scope')
	return {
		flow,
		round,
		data,
		status,
		error,
		fetcher,
		handler: () => handler,
		stop: () => scope.stop(),
	}
}
afterEach(() => vi.unstubAllGlobals())
describe('public submission overview lifecycle', () => {
	it('fetches without session and forwards cancellation signal', async () => {
		const { handler, fetcher, stop } = setup()
		const signal = new AbortController().signal
		expect(await handler()({}, { signal })).toMatchObject({
			owner: 'zsl-submission-overview:50',
		})
		expect(fetcher).toHaveBeenCalledWith('/api/super-league/submission-overview', {
			query: { roundId: 50 },
			signal,
		})
		stop()
	})
	it('retains last public snapshot when refresh fails', () => {
		const { flow, data, error, stop } = setup()
		const result = { contest: null, validCount: 1, totalCount: 3, submissions: [] }
		data.value = { owner: 'zsl-submission-overview:50', result }
		data.value = undefined
		error.value = new Error('Offline')
		expect(flow.data.value).toEqual(result)
		expect(flow.error.value?.message).toBe('Offline')
		stop()
	})
	it('clears old snapshot and ignores late response on round change', () => {
		const { flow, data, round, stop } = setup()
		data.value = {
			owner: 'zsl-submission-overview:50',
			result: { contest: null, validCount: 1, totalCount: 3, submissions: [] },
		}
		round.value = 51
		expect(flow.data.value).toBeNull()
		data.value = undefined
		expect(flow.data.value).toBeNull()
		data.value = {
			owner: 'zsl-submission-overview:50',
			result: { contest: null, validCount: 2, totalCount: 4, submissions: [] },
		}
		expect(flow.data.value).toBeNull()
		stop()
	})
})
