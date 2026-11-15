import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, shallowRef } from 'vue'
import { useSuperLeagueContests } from '../../app/composables/useSuperLeagueContests'
import type { SubmissionContest } from '../../app/utils/superLeagueSubmission'

afterEach(() => vi.unstubAllGlobals())

describe('shared Super League contest reads', () => {
	it('uses same-origin endpoint and reacts when initial client request resolves', () => {
		const data = shallowRef<SubmissionContest[]>([])
		const refresh = vi.fn()
		const fetcher = vi.fn().mockReturnValue({ data, refresh })
		const schedule = vi.fn()
		vi.stubGlobal('computed', computed)
		vi.stubGlobal('useFetch', fetcher)
		vi.stubGlobal('useContestDeadlineRefresh', schedule)
		const scope = effectScope()
		const read = scope.run(() => useSuperLeagueContests())
		expect(fetcher).toHaveBeenCalledWith('/api/super-league/contests')
		expect(read?.data.value).toEqual([])
		data.value = [
			{
				roundId: 50,
				openTypes: [2],
				resultTypes: [1],
				submissionStart: null,
				submissionEnd: null,
				zslVoteEnd: '2026-11-15T12:00:00Z',
				cosmeticVoteEnd: '2026-11-16T12:00:00Z',
			} as SubmissionContest,
		]
		expect(read?.data.value[0]).toMatchObject({ openTypes: [2], resultTypes: [1] })
		expect(schedule).toHaveBeenCalledWith(
			expect.objectContaining({
				value: [null, null, '2026-11-15T12:00:00Z', '2026-11-16T12:00:00Z'],
			}),
			refresh,
		)
		scope.stop()
	})
})
