import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, shallowRef, toValue, watch } from 'vue'
import type { SuperLeagueVoteSnapshot } from '../../app/composables/useSuperLeagueVote'
import { useSuperLeagueVoteResults } from '../../app/composables/useSuperLeagueVoteResults'
import {
	nextContestDeadline,
	type VoteResultLevel,
	type VoteResultsSnapshot,
	voteResultChartData,
	voteResultMarkers,
} from '../../app/utils/superLeagueVoteResults'

const level = (id: number, votes: number): VoteResultLevel => ({
	levelId: id,
	xxHash: `hash-${id}`,
	name: `Level ${id}`,
	imageUrl: null,
	votes,
})
const ballot = (roundId: number): SuperLeagueVoteSnapshot => ({
	roundId,
	contestId: 1,
	submissionStart: null,
	submissionEnd: null,
	zslVoteEnd: null,
	cosmeticVoteEnd: null,
	submissionsOpen: false,
	votingPending: false,
	openTypes: [],
	votes: [[1], [2], []],
	candidates: [1, 2, 3].map((id) => ({
		levelId: id,
		xxHash: `hash-${id}`,
		selfAuthored: id === 3,
		workshopId: id,
		adventure: false,
		dateCreated: '',
		name: null,
		imageUrl: null,
		authorName: null,
		points: null,
		rating: null,
		recordCount: 0,
		personalBestCount: 0,
		voteCount: 0,
	})),
})
const results = (roundId: number): VoteResultsSnapshot => ({
	roundId,
	categories: [
		{
			voteType: 1,
			state: 'published',
			deadline: null,
			totalVotes: 8,
			levels: [level(1, 8), level(2, 0)],
		},
		{ voteType: 2, state: 'pending', deadline: null, totalVotes: null, levels: [] },
		{ voteType: 3, state: 'pending', deadline: null, totalVotes: null, levels: [] },
	],
})
afterEach(() => vi.unstubAllGlobals())

describe('vote results presentation', () => {
	it('marks choices separately by category and all authored levels', () => {
		const markers = voteResultMarkers(50, ballot(50))
		expect([...(markers.voted[0] ?? [])]).toEqual([1])
		expect([...(markers.voted[1] ?? [])]).toEqual([2])
		expect([...markers.own]).toEqual([3])
	})
	it('drops viewer markers when no ballot exists or historical round differs', () => {
		for (const snapshot of [null, ballot(51)]) {
			const markers = voteResultMarkers(50, snapshot)
			expect(markers.voted.every((votes) => votes.size === 0)).toBe(true)
			expect(markers.own.size).toBe(0)
		}
	})
	it('preserves totals, zero votes, and duplicate names across chart series', () => {
		const rows = [
			level(1, 8),
			{ ...level(2, 0), name: 'Level 1' },
			{ ...level(3, 2), name: null },
		]
		const data = voteResultChartData(rows, new Set([1]))
		expect(data.map((row) => row.votes + row.votedVotes)).toEqual([8, 0, 2])
		expect(data[0]).toMatchObject({ votes: 0, votedVotes: 8, totalVotes: 8 })
		expect(data[2]?.name).toBe('hash-3')
		expect(rows[0]?.votes).toBe(8)
	})
	it('schedules next deadline, ignores invalid/past values, and caps timer duration', () => {
		const now = Date.parse('2026-10-04T17:00:00Z')
		expect(
			nextContestDeadline(
				['invalid', null, '2026-10-04T17:00:00Z', '2026-10-04T17:00:10Z'],
				now,
			),
		).toBe(11_000)
		expect(nextContestDeadline(['2026-11-04T17:00:00Z'], now)).toBe(2_147_483_647)
		expect(nextContestDeadline(['2026-10-03T17:00:00Z'], now)).toBeNull()
	})
})

function setup(fetcher: ReturnType<typeof vi.fn>) {
	const round = ref<number | undefined>(50)
	const privateSnapshot = shallowRef<SuperLeagueVoteSnapshot | null>(ballot(50))
	const reads: Promise<unknown>[] = []
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('toValue', toValue)
	vi.stubGlobal('$fetch', fetcher)
	vi.stubGlobal('useContestDeadlineRefresh', vi.fn())
	vi.stubGlobal('useSuperLeagueVote', () => ({
		snapshot: privateSnapshot,
		initial: Promise.resolve(),
		refresh: vi.fn(),
	}))
	vi.stubGlobal(
		'useAsyncData',
		(
			key: { value: string },
			handler: (app: object, context: { signal: AbortSignal }) => Promise<unknown>,
		) => {
			const data = shallowRef<unknown>()
			const status = ref('idle')
			const error = shallowRef<Error | null>(null)
			let controller: AbortController | undefined
			function refresh() {
				controller?.abort()
				controller = new AbortController()
				const active = controller
				status.value = 'pending'
				const promise = handler({}, { signal: active.signal })
					.then((value) => {
						if (!active.signal.aborted) {
							data.value = value
							status.value = 'success'
							error.value = null
						}
					})
					.catch((cause) => {
						if (!active.signal.aborted) {
							error.value = cause
							status.value = 'error'
						}
					})
				reads.push(promise)
				return promise
			}
			const initial = refresh()
			watch(key, () => {
				data.value = undefined
				refresh()
			})
			return Object.assign(initial, { data, status, error, refresh })
		},
	)
	const scope = effectScope()
	const read = scope.run(() => useSuperLeagueVoteResults(round))
	if (!read) throw new Error('Missing result scope')
	return {
		round,
		privateSnapshot,
		read,
		stop: () => scope.stop(),
		settle: async () => {
			await nextTick()
			await Promise.all(reads)
		},
	}
}

describe('public vote result reads', () => {
	it('loads anonymous results when private read has no session or fails', async () => {
		const fetcher = vi.fn().mockResolvedValue(results(50))
		const flow = setup(fetcher)
		flow.privateSnapshot.value = null
		await flow.settle()
		expect(flow.read.snapshot.value).toEqual(results(50))
		expect(flow.read.markers.value.own.size).toBe(0)
		expect(fetcher).toHaveBeenCalledWith(
			'/api/super-league/vote-results',
			expect.objectContaining({ query: { roundId: 50 }, credentials: 'omit' }),
		)
		flow.stop()
	})
	it('clears markers immediately on logout and round navigation', async () => {
		const flow = setup(
			vi
				.fn()
				.mockImplementation((_path, options) =>
					Promise.resolve(results(options.query.roundId)),
				),
		)
		await flow.settle()
		expect(flow.read.markers.value.own.has(3)).toBe(true)
		flow.privateSnapshot.value = null
		expect(flow.read.markers.value.own.size).toBe(0)
		flow.privateSnapshot.value = ballot(50)
		flow.round.value = 51
		expect(flow.read.snapshot.value).toBeNull()
		expect(flow.read.markers.value.own.size).toBe(0)
		await flow.settle()
		expect(flow.read.snapshot.value?.roundId).toBe(51)
		flow.stop()
	})
	it('ignores delayed responses from previous round', async () => {
		let finish!: (value: VoteResultsSnapshot) => void
		const flow = setup(
			vi
				.fn()
				.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							finish = resolve
						}),
				)
				.mockResolvedValue(results(51)),
		)
		flow.round.value = 51
		await nextTick()
		finish(results(50))
		await flow.settle()
		expect(flow.read.snapshot.value?.roundId).toBe(51)
		flow.stop()
	})
})
