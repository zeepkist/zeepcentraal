import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubmissionContest } from '../../app/utils/superLeagueSubmission'

type Destination = {
	path: string
	query: Record<string, string | null | string[]>
	hash: string
}
type Guard = (to: Destination) => Promise<unknown>
const lookup = vi.fn()
const redirect = vi.fn<(destination: unknown, options: unknown) => string>(() => 'redirected')
let guard: Guard

function contest(overrides: Partial<SubmissionContest> = {}): SubmissionContest {
	return {
		roundId: 50,
		contestId: 1,
		seasonId: 8,
		round: 1,
		name: 'Fixture contest',
		rules: {},
		steamAnnouncementId: null,
		submissionStart: '2099-10-01T17:00:00Z',
		submissionEnd: '2099-10-20T17:00:00Z',
		zslVoteEnd: '2099-10-25T17:00:00Z',
		cosmeticVoteEnd: '2099-10-30T17:00:00Z',
		submissionsOpen: false,
		openTypes: [],
		resultTypes: [],
		...overrides,
	}
}

function destination(activity = 'vote'): Destination {
	return { path: `/super-league/${activity}`, query: {}, hash: '' }
}

beforeEach(async () => {
	lookup.mockReset()
	redirect.mockClear()
	vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: Guard) => middleware)
	vi.stubGlobal('useRuntimeConfig', () => ({
		public: { backendUrl: 'https://backend.example.test' },
	}))
	vi.stubGlobal('$fetch', lookup)
	vi.stubGlobal('navigateTo', redirect)
	guard = (await import('../../app/middleware/super-league-active-round'))
		.default as unknown as Guard
})
afterEach(() => vi.unstubAllGlobals())

describe('Super League entry redirects', () => {
	it('selects different active rounds for voting and submissions', async () => {
		lookup.mockResolvedValue([
			contest({ roundId: 51, submissionsOpen: true }),
			contest({ roundId: 50, openTypes: [1, 2, 3] }),
		])
		for (const [activity, roundId] of [
			['vote', '50'],
			['submit-level', '51'],
		]) {
			const to = destination(activity)
			expect(await guard(to)).toBe('redirected')
			expect(redirect).toHaveBeenLastCalledWith(
				{ ...to, query: { roundId } },
				{ redirectCode: 302, replace: true },
			)
		}
		expect(lookup).toHaveBeenCalledWith('https://backend.example.test/super-league/contests', {
			credentials: 'omit',
			cache: 'no-store',
		})
	})
	it('selects earliest submission deadline, regardless of API ordering', async () => {
		lookup.mockResolvedValue([
			contest({ roundId: 52, submissionsOpen: true, submissionEnd: '2099-11-01T17:00:00Z' }),
			contest({ roundId: 51, submissionsOpen: true }),
		])
		await guard(destination('submit-level'))
		expect(redirect.mock.lastCall?.[0]).toMatchObject({ query: { roundId: '51' } })
	})
	it('uses earliest deadline among open voting categories', async () => {
		lookup.mockResolvedValue([
			contest({ roundId: 52, openTypes: [2, 3], cosmeticVoteEnd: '2099-10-27T17:00:00Z' }),
			contest({ roundId: 51, openTypes: [1, 2, 3] }),
		])
		await guard(destination())
		expect(redirect.mock.lastCall?.[0]).toMatchObject({ query: { roundId: '51' } })
	})
	it('ignores closed ZSL deadline while cosmetic voting remains open', async () => {
		lookup.mockResolvedValue([
			contest({ roundId: 52, openTypes: [2, 3], zslVoteEnd: '2000-01-01T00:00:00Z' }),
			contest({ roundId: 51, openTypes: [1], zslVoteEnd: '2099-10-27T17:00:00Z' }),
		])
		await guard(destination())
		expect(redirect.mock.lastCall?.[0]).toMatchObject({ query: { roundId: '51' } })
	})
	it.each([
		[
			contest({ seasonId: 9, round: 1, roundId: 51 }),
			contest({ seasonId: 8, round: 6, roundId: 52 }),
			'51',
		],
		[contest({ round: 2, roundId: 51 }), contest({ round: 1, roundId: 52 }), '51'],
		[contest({ roundId: 51 }), contest({ roundId: 52 }), '52'],
	])('breaks equal deadlines by season, round, then ID', async (a, b, roundId) => {
		lookup.mockResolvedValue([
			{ ...a, openTypes: [1] },
			{ ...b, openTypes: [1] },
		])
		await guard(destination())
		expect(redirect.mock.lastCall?.[0]).toMatchObject({ query: { roundId } })
	})
	it('preserves other query parameters and hash', async () => {
		lookup.mockResolvedValue([contest({ openTypes: [1] })])
		const to = {
			...destination(),
			query: { source: 'news', tag: ['one', 'two'] },
			hash: '#ballot',
		}
		await guard(to)
		expect(redirect).toHaveBeenCalledWith(
			{ ...to, query: { ...to.query, roundId: '50' } },
			{ redirectCode: 302, replace: true },
		)
	})
	it.each(['50', '0', 'invalid', '', null, ['50', '51']])(
		'leaves supplied roundId unchanged: %j',
		async (roundId) => {
			await guard({ ...destination(), query: { roundId } })
			expect(lookup).not.toHaveBeenCalled()
			expect(redirect).not.toHaveBeenCalled()
		},
	)
	it.each(['vote', 'submit-level'])('skips future and closed rounds for %s', async (activity) => {
		lookup.mockResolvedValue([
			contest({ submissionEnd: '2000-01-01T00:00:00Z', zslVoteEnd: '2000-01-01T00:00:00Z' }),
			contest({ roundId: 51, submissionStart: '2099-11-01T00:00:00Z' }),
		])
		await guard(destination(activity))
		expect(redirect).toHaveBeenCalledWith('/super-league', { redirectCode: 302, replace: true })
	})
	it.each(['vote', 'submit-level'])(
		'redirects empty contests to overview for %s',
		async (activity) => {
			lookup.mockResolvedValue([])
			await guard(destination(activity))
			expect(redirect).toHaveBeenCalledWith('/super-league', {
				redirectCode: 302,
				replace: true,
			})
		},
	)
	it('redirects lookup failures to overview', async () => {
		lookup.mockRejectedValue(new Error('Backend unavailable'))
		await guard(destination())
		expect(redirect).toHaveBeenCalledWith('/super-league', { redirectCode: 302, replace: true })
	})
	it('resolves availability again on each navigation', async () => {
		lookup.mockResolvedValueOnce([contest({ openTypes: [1] })]).mockResolvedValueOnce([])
		await guard(destination())
		await guard(destination())
		expect(lookup).toHaveBeenCalledTimes(2)
		expect(redirect).toHaveBeenLastCalledWith('/super-league', {
			redirectCode: 302,
			replace: true,
		})
	})
	it.each(['/super-league', '/levels'])(
		'never redirects unrelated destination %s',
		async (path) => {
			await guard({ ...destination(), path })
			expect(lookup).not.toHaveBeenCalled()
			expect(redirect).not.toHaveBeenCalled()
		},
	)
})
