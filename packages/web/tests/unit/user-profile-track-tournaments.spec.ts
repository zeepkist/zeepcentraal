import { readFileSync } from 'node:fs'
import type { Zc_UserTrackTournamentResultsQuery } from '@zeepkist/graphql/generated'
import { buildSchema, Kind, parse, validate, valueFromASTUntyped, visit } from 'graphql'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope, Ref } from 'vue'
import { computed, effectScope, nextTick, reactive, ref, toValue, watch } from 'vue'
import { useCursorPagination } from '../../app/composables/useCursorPagination'
import type { UserProfileSummaryModel } from '../../app/composables/useUserProfileSummary'
import { useUserTrackTournaments } from '../../app/composables/useUserTrackTournaments'
import {
	formatTournamentPeriod,
	formatTournamentTime,
	tournamentPath,
} from '../../app/utils/tournament'
import {
	mapUserTrackTournamentPage,
	mapUserTrackTournamentResults,
} from '../../app/utils/userTrackTournaments'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@urql/vue', () => ({ useClientHandle: () => ({ client: { query: mocks.query } }) }))

type Connection = NonNullable<Zc_UserTrackTournamentResultsQuery['trackTournaments']>
type TournamentNode = Connection['edges'][number]['node']

function tournament(overrides: Partial<TournamentNode> = {}): TournamentNode {
	return {
		id: 21,
		type: 0,
		slug: '2026-w40',
		startAt: '2026-09-28T06:00:00Z',
		endAt: '2026-10-05T06:00:00Z',
		finalizedAt: null,
		level: {
			xxHash: '0123456789abcdef',
			levelItems: {
				nodes: [
					{
						name: 'Weekly track',
						imageUrl: '/weekly-track.png',
						author: { steamName: 'Track author' },
					},
				],
			},
		},
		trackTournamentResults: { nodes: [{ userId: 7, rank: 3, points: 26, time: 61.125 }] },
		...overrides,
	}
}

function connection(nodes: TournamentNode[] = [tournament()]): Connection {
	return {
		edges: nodes.map((node) => ({ node })),
		pageInfo: {
			startCursor: 'start',
			endCursor: 'end',
			hasNextPage: true,
			hasPreviousPage: false,
		},
	}
}

const scopes: EffectScope[] = []

afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop()
	vi.unstubAllGlobals()
	vi.clearAllMocks()
})

function setup(activeInitially = true) {
	const steamId = ref('10000000000000001')
	const user = ref<{ id: number; steamId: string } | undefined>({ id: 7, steamId: steamId.value })
	const active = ref(activeInitially)
	const route = reactive({ query: {} as Record<string, string>, params: {} })
	const states = new Map<string, Ref<unknown>>()
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('watch', watch)
	vi.stubGlobal('toValue', toValue)
	vi.stubGlobal('useRoute', () => route)
	vi.stubGlobal('useRouter', () => ({
		push: async ({ query }: { query: Record<string, string> }) => {
			route.query = query
		},
	}))
	vi.stubGlobal('useState', (key: string, initialize: () => unknown) => {
		if (!states.has(key)) states.set(key, ref(initialize()))
		return states.get(key)
	})
	vi.stubGlobal('useCursorPagination', useCursorPagination)
	mocks.query.mockImplementation((_document, variables) => ({
		toPromise: async () => ({
			data: {
				trackTournaments: connection([
					tournament({
						type: variables.type,
						trackTournamentResults: {
							nodes: [
								{ userId: variables.userId, rank: 3, points: 26, time: 61.125 },
							],
						},
					}),
				]),
			},
		}),
	}))
	const scope = effectScope()
	scopes.push(scope)
	const create = (type: 0 | 1) => {
		const panel = scope.run(() =>
			useUserTrackTournaments(
				steamId,
				{ user } as unknown as UserProfileSummaryModel,
				type,
				active,
			),
		)
		if (!panel) throw new Error('Test scope is inactive')
		return panel
	}
	return { steamId, user, active, route, create }
}

async function settle() {
	await nextTick()
	await Promise.resolve()
	await nextTick()
}

describe('profile tournament query', () => {
	const document = parse(
		readFileSync(
			new URL(
				'../../../graphql/documents/web/queries/userTrackTournaments.graphql',
				import.meta.url,
			),
			'utf8',
		),
	)

	it('validates against checked-in schema', () => {
		const schema = buildSchema(
			readFileSync(new URL('../../../graphql/schema.graphql', import.meta.url), 'utf8'),
		)
		expect(validate(schema, document)).toEqual([])
	})

	it.each([0, 1])('filters type %i, started tournaments, and owner before pagination', (type) => {
		const variables = { userId: 7, type, now: '2026-09-30T12:00:00Z', first: 6 }
		const fields: Array<{ name: string; arguments: Record<string, unknown> }> = []
		visit(document, {
			Field(node) {
				if (
					node.name.value !== 'trackTournaments' &&
					node.name.value !== 'trackTournamentResults'
				)
					return
				fields.push({
					name: node.name.value,
					arguments: Object.fromEntries(
						(node.arguments ?? []).map((argument) => [
							argument.name.value,
							valueFromASTUntyped(argument.value, variables),
						]),
					),
				})
			},
		})
		expect(fields[0]?.arguments).toMatchObject({
			first: 6,
			filter: {
				type: { equalTo: type },
				startAt: { lessThanOrEqualTo: variables.now },
				trackTournamentResults: { some: { userId: { equalTo: 7 } } },
			},
			orderBy: ['START_AT_DESC', 'ID_DESC'],
		})
		expect(fields[1]?.arguments).toEqual({ first: 1, filter: { userId: { equalTo: 7 } } })
		expect(Object.keys(fields[0]?.arguments.filter as object)).toEqual([
			'type',
			'startAt',
			'trackTournamentResults',
		])
		expect(document.definitions[0]?.kind).toBe(Kind.OPERATION_DEFINITION)
	})
})

describe('profile tournament mapping', () => {
	it('maps owner results, time, and provisional/finalized states', () => {
		const final = tournament({ id: 20, finalizedAt: '2026-09-28T06:01:00Z' })
		const rows = mapUserTrackTournamentResults(connection([tournament(), final]), 7)
		expect(rows.map((row) => row.id)).toEqual([21, 20])
		expect(rows[0]).toMatchObject({ rank: 3, points: 26, time: 61.125, finalizedAt: null })
		expect(rows[0]).toMatchObject({ imageUrl: '/weekly-track.png', authorName: 'Track author' })
		expect(rows[1]?.finalizedAt).toBe(final.finalizedAt)
		expect(formatTournamentTime(rows[0]?.time ?? 0)).toBe('1:01.125')
	})

	it('handles empty results and rejects results belonging to another owner', () => {
		expect(mapUserTrackTournamentResults(undefined, 7)).toEqual([])
		expect(mapUserTrackTournamentResults(connection([]), 7)).toEqual([])
		expect(mapUserTrackTournamentResults(connection(), 8)).toEqual([])
	})

	it('falls back to hash when workshop metadata is absent and supports missing level', () => {
		const rows = mapUserTrackTournamentResults(
			connection([
				tournament({ level: { xxHash: '0123456789abcdef', levelItems: { nodes: [] } } }),
				tournament({ id: 22, level: null }),
			]),
			7,
		)
		expect(rows.map((row) => row.levelName)).toEqual(['0123456789', null])
		expect(rows.map((row) => [row.imageUrl, row.authorName])).toEqual([
			[null, null],
			[null, null],
		])
	})

	it('uses existing weekly/monthly labels and standings links', () => {
		expect(
			formatTournamentPeriod(0, '2026-w40', 'en', ({ year, week }) => `${year} Week ${week}`),
		).toBe('2026 Week 40')
		expect(formatTournamentPeriod(1, '2026-09', 'en', () => '')).toBe('September 2026')
		expect(tournamentPath(0, '2026-w40')).toBe('/totw/2026-w40')
		expect(tournamentPath(1, '2026-09')).toBe('/totm/2026-09')
		expect(mapUserTrackTournamentPage()).toEqual({ hasNextPage: false, hasPreviousPage: false })
	})
})

describe('profile tournament snapshots', () => {
	it('waits for Career activation and owner ID, then keeps snapshot across activation', async () => {
		const state = setup(false)
		state.user.value = undefined
		const panel = state.create(0)
		await settle()
		expect(mocks.query).not.toHaveBeenCalled()
		state.active.value = true
		await settle()
		expect(mocks.query).not.toHaveBeenCalled()
		state.user.value = { id: 7, steamId: state.steamId.value }
		await settle()
		expect(mocks.query).toHaveBeenCalledOnce()
		expect(mocks.query.mock.calls[0]?.[2]).toEqual({ requestPolicy: 'cache-first' })
		expect(panel.pending.value).toBe(false)
		state.active.value = false
		await settle()
		state.active.value = true
		await settle()
		expect(mocks.query).toHaveBeenCalledOnce()
	})

	it('paginates panels independently and reuses visited pages without refetching', async () => {
		const state = setup()
		state.route.query = { tab: 'career', unrelated: 'keep' }
		const weekly = state.create(0)
		const monthly = state.create(1)
		await settle()
		expect(mocks.query.mock.calls.map((call) => call[1].type)).toEqual([0, 1])
		await weekly.pagination.next(weekly.page.value)
		await settle()
		expect(state.route.query).toMatchObject({
			userTotwAfter: 'end',
			tab: 'career',
			unrelated: 'keep',
		})
		expect(mocks.query).toHaveBeenCalledTimes(3)
		await weekly.pagination.previous(weekly.page.value)
		await settle()
		expect(state.route.query.userTotwBefore).toBe('start')
		expect(mocks.query).toHaveBeenCalledTimes(3)
		await weekly.pagination.next(weekly.page.value)
		await settle()
		expect(state.route.query.userTotwAfter).toBe('end')
		expect(mocks.query).toHaveBeenCalledTimes(3)
		await monthly.pagination.next(monthly.page.value)
		await settle()
		expect(state.route.query).toMatchObject({ userTotwAfter: 'end', userTotmAfter: 'end' })
		expect(mocks.query).toHaveBeenCalledTimes(4)
		await weekly.pagination.first()
		await settle()
		expect(state.route.query.userTotmAfter).toBe('end')
		expect(mocks.query).toHaveBeenCalledTimes(4)
		const remounted = state.create(0)
		await settle()
		expect(remounted.results.value).toEqual(weekly.results.value)
		expect(mocks.query).toHaveBeenCalledTimes(4)
	})

	it('hides stale owner rows immediately and preserves separately cached owner snapshots', async () => {
		const state = setup()
		const panel = state.create(0)
		await settle()
		state.steamId.value = '10000000000000002'
		expect(panel.results.value).toEqual([])
		await settle()
		expect(mocks.query).toHaveBeenCalledOnce()
		state.user.value = { id: 8, steamId: state.steamId.value }
		expect(panel.results.value).toEqual([])
		await settle()
		expect(panel.results.value).toHaveLength(1)
		expect(mocks.query.mock.calls[1]?.[1].userId).toBe(8)
		state.steamId.value = '10000000000000001'
		state.user.value = { id: 7, steamId: state.steamId.value }
		await settle()
		expect(mocks.query).toHaveBeenCalledTimes(2)
	})

	it('handles empty/error snapshots without automatic retries', async () => {
		const state = setup()
		mocks.query.mockReturnValue({
			toPromise: async () => ({ data: { trackTournaments: connection([]) } }),
		})
		const empty = state.create(0)
		await settle()
		expect(empty.results.value).toEqual([])
		expect(empty.pending.value).toBe(false)
		expect(empty.error.value).toBeUndefined()
		mocks.query.mockReturnValue({
			toPromise: async () => {
				throw new Error('Tournament request failed')
			},
		})
		const failed = state.create(1)
		await settle()
		expect(failed.error.value).toBe('Tournament request failed')
		expect(failed.pending.value).toBe(false)
		state.active.value = false
		await settle()
		state.active.value = true
		await settle()
		expect(mocks.query).toHaveBeenCalledTimes(2)
	})
})
