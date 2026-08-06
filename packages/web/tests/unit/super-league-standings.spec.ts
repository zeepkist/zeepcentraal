import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ZslStanding } from '../../app/types/app'
import { mapSeasonRoundPoints, mergeViewerStanding } from '../../app/utils/zslStandings'

const composable = readFileSync(new URL('../../app/composables/useZsl.ts', import.meta.url), 'utf8')
const seasonResults = readFileSync(
	new URL('../../../graphql/documents/web/queries/zslSeasonResults.graphql', import.meta.url),
	'utf8',
)
const roundResults = readFileSync(
	new URL('../../../graphql/documents/web/queries/zslRoundResults.graphql', import.meta.url),
	'utf8',
)
const levelResults = readFileSync(
	new URL('../../../graphql/documents/web/queries/zslLevelResults.graphql', import.meta.url),
	'utf8',
)
const levelQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/zslLevel.graphql', import.meta.url),
	'utf8',
)
const table = readFileSync(
	new URL('../../app/components/zsl/ZslStandingsTable.vue', import.meta.url),
	'utf8',
)
const sharedRow = readFileSync(
	new URL('../../app/components/common/DataTableRow.vue', import.meta.url),
	'utf8',
)
const seasonPage = readFileSync(
	new URL('../../app/pages/super-league/[seasonSlug]/index.vue', import.meta.url),
	'utf8',
)
const roundPage = readFileSync(
	new URL('../../app/pages/super-league/[seasonSlug]/[roundSlug]/index.vue', import.meta.url),
	'utf8',
)
const levelPage = readFileSync(
	new URL(
		'../../app/pages/super-league/[seasonSlug]/[roundSlug]/[levelSlug].vue',
		import.meta.url,
	),
	'utf8',
)
const routeFiles = [seasonPage, roundPage, levelPage]

describe('Super League standings loading', () => {
	it('loads exactly 50 cursor-paginated results ordered by position', () => {
		expect(composable.match(/useCursorPagination\(50/g)).toHaveLength(3)
		for (const query of [seasonResults, roundResults, levelResults]) {
			expect(query).toContain('$first: Int')
			expect(query).toContain('$after: Cursor')
			expect(query).toContain('$last: Int')
			expect(query).toContain('$before: Cursor')
			expect(query).toContain('orderBy: [POSITION_ASC]')
			expect(query).not.toContain('offset:')
		}
	})

	it('filters round results through semantic season and round fields', () => {
		expect(roundResults).toContain('$seasonId: Int!')
		expect(roundResults).toContain('$round: Int!')
		expect(roundResults).toContain(
			'round: { seasonId: { equalTo: $seasonId }, round: { equalTo: $round } }',
		)
		expect(roundResults).not.toContain('roundId: { equalTo: $id }')
	})

	it('loads round scores and level participation with bounded nested connections', () => {
		expect(seasonResults).toContain('zslRoundResults(')
		expect(seasonResults).toContain('first: 6')
		expect(seasonResults).toContain('orderBy: [ROUND_ID_ASC]')
		expect(roundResults).toContain('zslLevelResults(')
		expect(roundResults).toContain('first: 0')
		expect(roundResults).toContain(
			'level: { round: { seasonId: { equalTo: $seasonId }, round: { equalTo: $round } } }',
		)
	})

	it('SSR-prefetches details and standings without viewport gates', () => {
		expect(composable).not.toContain('useViewportPrefetch')
		expect(composable).toContain('await Promise.all([result, standingsResult])')
		for (const page of routeFiles) {
			expect(page).toContain('await prefetch()')
			expect(page).not.toContain('standingsTarget')
			expect(page).not.toContain('standingsActive')
		}
	})

	it('keeps the resolved table snapshot during cursor requests', () => {
		expect(composable).toContain('function stageStandings(')
		expect(composable).toContain('if (fetching.value || !hasData.value) return')
		expect(composable).toContain('resolved.value ? snapshot.value : rows.value')
	})

	it('uses one stable fastest time across level-result cursor pages', () => {
		expect(levelQuery).toContain('zslLevelResults(first: 0)')
		expect(levelQuery).toContain('aggregates')
		expect(levelQuery).toContain('min')
		expect(composable).toContain(
			'level.value?.zslLevelResults.aggregates?.min?.time ?? undefined',
		)
		expect(levelPage).toContain(':fastest-time="fastestTime"')
		expect(levelPage).toContain('show-delta')
		expect(seasonPage).not.toContain('show-delta')
		expect(roundPage).not.toContain('show-delta')
		expect(table).toContain('props.showDelta && props.fastestTime !== undefined')
		expect(table).toContain('formatTournamentDelta(row.time, fastestTime)')
		expect(table).toContain('class="p-0 tabular-nums text-muted"')
	})
})

describe('Super League season round points', () => {
	it('shows only best-of round scores in their six fixed columns', () => {
		expect(
			mapSeasonRoundPoints(
				[
					{ points: 10, round: { round: 1 } },
					{ points: 50, round: { round: 2 } },
					{ points: 20, round: { round: 3 } },
					{ points: 40, round: { round: 4 } },
					{ points: 30, round: { round: 5 } },
					{ points: 5, round: { round: 6 } },
				],
				4,
			),
		).toEqual([null, 50, 20, 40, 30, null])
	})

	it('uses earlier round as deterministic best-of tie-breaker', () => {
		expect(
			mapSeasonRoundPoints(
				[
					{ points: 25, round: { round: 2 } },
					{ points: 25, round: { round: 1 } },
				],
				1,
			),
		).toEqual([25, null, null, null, null, null])
	})
})

describe('Super League viewer standings', () => {
	it('requests one authenticated viewer result in each standings operation', () => {
		for (const query of [seasonResults, roundResults, levelResults]) {
			expect(query).toContain('$viewerId: Int!')
			expect(query).toContain('$includeViewer: Boolean!')
			expect(query).toContain('viewerStanding:')
			expect(query).toContain('first: 1')
			expect(query).toContain('userId: { equalTo: $viewerId }')
			expect(query).toContain('@include(if: $includeViewer)')
			expect(query).toContain('userId')
			expect(query).toContain('id')
		}
	})

	it('appends an off-page viewer with true result and prevents duplicates', () => {
		const rows: ZslStanding[] = [
			{
				userId: 1,
				position: 1,
				points: 100,
				steamId: 'one',
				steamName: 'One',
			},
		]
		const viewer = {
			userId: 42,
			position: 81,
			points: 12,
			user: { steamId: 'viewer', steamName: 'Viewer' },
		}
		expect(mergeViewerStanding(rows, viewer)).toEqual([
			...rows,
			{
				userId: 42,
				position: 81,
				points: 12,
				steamId: 'viewer',
				steamName: 'Viewer',
				time: undefined,
				pinned: true,
			},
		])
		expect(
			mergeViewerStanding(
				[
					...rows,
					{
						userId: 42,
						position: 42,
						points: 42,
						steamId: 'viewer',
						steamName: 'Viewer',
					},
				],
				viewer,
			),
		).toHaveLength(2)
	})

	it('passes session identity and highlights viewer rows', () => {
		for (const page of routeFiles) {
			expect(page).toContain('const viewerId = computed(() => session.user?.id)')
			expect(page).toContain(':viewer-user-id="viewerId"')
		}
		expect(table).toContain(':viewer="viewerUserId === row.userId"')
		expect(table).toContain(':pinned="row.pinned"')
		expect(sharedRow).toContain("viewer ? 'bg-primary/10 text-highlighted' : 'bg-card/60'")
		expect(sharedRow).toContain("pinned ? 'border-t-2 border-primary/40'")
		expect(table).toContain('labels.yourStanding')
	})
})
