import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	applySuperLeagueBestOf,
	buildUserSuperLeagueSummary,
} from '../../app/utils/userSuperLeague'

const query = readFileSync(
	new URL('../../app/graphql/queries/userSuperLeague.graphql', import.meta.url),
	'utf8',
)
const component = readFileSync(
	new URL('../../app/components/user/UserSuperLeaguePanel.vue', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useUserProfile.ts', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/user/[steamid].vue', import.meta.url), 'utf8')

describe('user profile Super League panel', () => {
	it('loads every season and viewer-specific selected-season results', () => {
		expect(query).toContain('zslSeasons(first: 1000, orderBy: [START_DATE_DESC])')
		expect(query).toContain('currentSeason: zslSeasons(first: 1, orderBy: [START_DATE_DESC])')
		expect(query).toContain('pointsStructure {')
		expect(query).toContain('bestOf')
		expect(query).toContain(
			'zslSeasonResults(first: 1, filter: { userId: { equalTo: $userId } })',
		)
		expect(query).toContain('zslRounds(first: 6, orderBy: [ROUND_ASC])')
		expect(query).toContain(
			'zslRoundResults(first: 1, filter: { userId: { equalTo: $userId } })',
		)
	})

	it('counts only highest best-of round scores and breaks ties by round order', () => {
		const rounds = [
			{ id: 1, round: 1, name: 'One', eventDate: '', position: 4, points: 10 },
			{ id: 2, round: 2, name: 'Two', eventDate: '', position: 1, points: 30 },
			{ id: 3, round: 3, name: 'Three', eventDate: '', position: 2, points: 20 },
		]
		expect(applySuperLeagueBestOf(rounds, 2).map(({ id, counted }) => [id, counted])).toEqual([
			[1, false],
			[2, true],
			[3, true],
		])

		const tied = rounds.slice(0, 2).map((round) => ({ ...round, points: 20 }))
		expect(applySuperLeagueBestOf(tied, 1).map(({ counted }) => counted)).toEqual([true, false])
	})

	it('maps only rounds entered by player', () => {
		const summary = buildUserSuperLeagueSummary({
			id: 7,
			name: 'Season 7',
			startDate: '2026-01-01T00:00:00Z',
			endDate: '2026-06-01T00:00:00Z',
			pointsStructure: { bestOf: 1 },
			zslSeasonResults: { nodes: [{ position: 12, points: 25 }] },
			zslRounds: {
				nodes: [
					{
						id: 41,
						round: 1,
						name: 'Round One',
						eventDate: '2026-02-01T00:00:00Z',
						zslRoundResults: { nodes: [{ position: 8, points: 25 }] },
					},
					{
						id: 42,
						round: 2,
						name: 'Round Two',
						eventDate: '2026-03-01T00:00:00Z',
						zslRoundResults: { nodes: [] },
					},
				],
			},
		})
		expect(summary?.position).toBe(12)
		expect(summary?.points).toBe(25)
		expect(summary?.rounds).toHaveLength(1)
		expect(summary?.rounds[0]).toMatchObject({ name: 'Round One', counted: true })
	})

	it('keeps network activity in composable and panel request-free', () => {
		expect(component).not.toContain('useQuery')
		expect(component).toContain('<USelect')
		expect(component).toContain('labels.emptyValue')
		expect(component).toContain('round.counted ? number.format(round.points)')
		expect(composable).toContain('Zc_UserSuperLeagueSeasonsDocument')
		expect(composable).toContain('Zc_UserSuperLeagueSeasonDocument')
		expect(composable).toContain('currentSuperLeagueSeason')
		expect(composable).toContain(
			'selectedSuperLeagueSeasonId.value === currentSuperLeagueSeason.value?.id',
		)
		expect(composable).toContain(
			'await Promise.all([pointsHistoryQuery, superLeagueSeasonsQuery, wrResult.value])',
		)
		expect(composable).not.toContain('if (!import.meta.server) return')
		expect(page).toContain('data.superLeagueSeasonsQuery.data.value === undefined')
		expect(page).toContain('data.superLeagueSeasonQuery.data.value === undefined')
	})

	it('renders below Career Summary with semantic standings link', () => {
		expect(page.indexOf('id="profile-super-league"')).toBeGreaterThan(
			page.indexOf('id="profile-summary"'),
		)
		expect(page).toContain('/super-league/season-')
		expect(page).toContain('@update:selected-season-id')
	})
})
