import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const composable = readFileSync(new URL('../../app/composables/useZsl.ts', import.meta.url), 'utf8')
const seasonResults = readFileSync(
	new URL('../../app/graphql/queries/zslSeasonResults.graphql', import.meta.url),
	'utf8',
)
const roundResults = readFileSync(
	new URL('../../app/graphql/queries/zslRoundResults.graphql', import.meta.url),
	'utf8',
)
const levelResults = readFileSync(
	new URL('../../app/graphql/queries/zslLevelResults.graphql', import.meta.url),
	'utf8',
)
const routeFiles = [
	'../../app/pages/super-league/[seasonSlug]/index.vue',
	'../../app/pages/super-league/[seasonSlug]/[roundSlug]/index.vue',
	'../../app/pages/super-league/[seasonSlug]/[roundSlug]/[levelSlug].vue',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))

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
})
