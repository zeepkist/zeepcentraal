import { readFileSync } from 'node:fs'
import type { Zc_TrackTournamentOverallStandingFragment } from '@zeepkist/graphql/generated'
import { buildSchema, parse, validate } from 'graphql'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, watch } from 'vue'
import { useTrackTournamentOverall } from '../../app/composables/useTrackTournamentOverall'
import { pinOverallViewer } from '../../app/utils/tournamentOverall'

const mocks = vi.hoisted(() => ({ useQuery: vi.fn(), useWindowFocus: vi.fn() }))
vi.mock('@urql/vue', () => ({ useQuery: mocks.useQuery }))
vi.mock('@vueuse/core', () => ({ useWindowFocus: mocks.useWindowFocus }))
afterEach(() => vi.unstubAllGlobals())

const row = (userId: number, rank = 1): Zc_TrackTournamentOverallStandingFragment => ({
	userId,
	rank,
	totalPoints: 1000,
	eventsPlayed: 1,
	user: { steamId: String(userId), steamName: `Player ${userId}` },
})

describe('overall leaderboard', () => {
	it('refreshes on visible focus and suppresses refresh while hidden', async () => {
		const focused = ref(true)
		const visible = ref(true)
		const executeQuery = vi.fn()
		mocks.useWindowFocus.mockReturnValue(focused)
		mocks.useQuery.mockReturnValue({ data: ref(undefined), executeQuery })
		vi.stubGlobal('computed', computed)
		vi.stubGlobal('watch', watch)
		vi.stubGlobal('usePageVisibility', () => visible)
		vi.stubGlobal('useCursorPagination', () => ({ variables: ref({ first: 50 }) }))
		const scope = effectScope()
		try {
			scope.run(() => useTrackTournamentOverall(0, ref(undefined)))
			visible.value = false
			focused.value = false
			await nextTick()
			focused.value = true
			await nextTick()
			expect(executeQuery).not.toHaveBeenCalled()
			visible.value = true
			await nextTick()
			expect(executeQuery).toHaveBeenCalledExactlyOnceWith({ requestPolicy: 'network-only' })
		} finally {
			scope.stop()
		}
	})
	it('pins viewer outside page without changing ranks or duplicating viewer', () => {
		const rows = [row(1), row(2), row(3, 3)]
		expect(pinOverallViewer(rows, row(2))).toEqual(rows)
		expect(pinOverallViewer(rows, row(50, 50))).toEqual([
			...rows,
			{ ...row(50, 50), pinned: true },
		])
		expect(pinOverallViewer([], null)).toEqual([])
		expect(rows).toHaveLength(3)
	})
	it('supports cursor queries, viewer lookup, and metadata without mutations', () => {
		const schema = buildSchema(
			readFileSync(new URL('../../../graphql/schema.graphql', import.meta.url), 'utf8'),
		)
		const document = parse(
			readFileSync(
				new URL(
					'../../../graphql/documents/web/queries/trackTournamentOverall.graphql',
					import.meta.url,
				),
				'utf8',
			),
		)
		expect(validate(schema, document)).toEqual([])
		expect(schema.getMutationType()).toBeUndefined()
		const fields = schema.getQueryType()?.getFields()
		expect(fields?.trackTournamentOverallStanding?.args.map((arg) => arg.name)).toEqual([
			'type',
			'userId',
		])
		expect(fields?.trackTournamentOverallStandings?.args.map((arg) => arg.name)).toEqual(
			expect.arrayContaining(['first', 'after', 'last', 'before', 'condition', 'orderBy']),
		)
	})
})
