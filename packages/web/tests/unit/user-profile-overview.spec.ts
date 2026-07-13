import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { steamProfileUrl, steamWorkshopProfileUrl } from '../../app/utils/steamProfile'
import {
	buildUserCareerHistory,
	getUserCareerHistoryWindow,
} from '../../app/utils/userCareerHistory'

const profileQuery = readFileSync(
	new URL('../../app/graphql/queries/userProfile.graphql', import.meta.url),
	'utf8',
)
const historyQuery = readFileSync(
	new URL('../../app/graphql/queries/userPointsHistory.graphql', import.meta.url),
	'utf8',
)
const statisticsQuery = readFileSync(
	new URL('../../app/graphql/queries/userStatistics.graphql', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/user/[steamid].vue', import.meta.url), 'utf8')
const hero = readFileSync(
	new URL('../../app/components/user/UserDetailHero.vue', import.meta.url),
	'utf8',
)
const statCard = readFileSync(
	new URL('../../app/components/common/StatCard.vue', import.meta.url),
	'utf8',
)

describe('user profile overview', () => {
	it('builds validated Steam profile and workshop links', () => {
		expect(steamProfileUrl('76561198000000000')).toBe(
			'https://steamcommunity.com/profiles/76561198000000000',
		)
		expect(steamWorkshopProfileUrl('76561198000000000')).toBe(
			'https://steamcommunity.com/profiles/76561198000000000/myworkshopfiles/?appid=1440670',
		)
		expect(steamProfileUrl('123')).toBeUndefined()
		expect(steamWorkshopProfileUrl('not-a-steam-id')).toBeUndefined()
	})

	it('renders critical profile data through the request-free hero', () => {
		expect(profileQuery).toContain('userPoints {')
		expect(profileQuery).toContain('levelItems(first: 0')
		expect(page).toContain('await data.prefetchCritical()')
		expect(page).toContain('<UserDetailHero')
		expect(page).toContain('/levels?author=')
		expect(page).toContain('steamId.value')
		expect(hero).toContain('labels.globalRank')
		expect(hero).toContain('labels.rankedPoints')
		expect(hero).toContain('target="_blank"')
		expect(hero).not.toContain('useQuery')
	})

	it('supports linked metrics without changing static cards', () => {
		expect(statCard).toContain("props.to ? resolveComponent('NuxtLink') : 'div'")
		expect(statCard).toContain('focus-visible:outline-primary')
		expect(statCard).toContain('motion-safe:group-hover:-translate-y-1')
	})

	it('queries one baseline, grouped history, and count-only telemetry', () => {
		expect(historyQuery).toContain('baseline: userPointsHistories(')
		expect(historyQuery).toContain('first: 1')
		expect(historyQuery).toContain('history: userPointsHistories(')
		expect(historyQuery).toContain('first: 0')
		expect(historyQuery).toContain('groupedAggregates(groupBy: [DATE_CREATED])')
		expect(statisticsQuery).toContain('$minimumModVersion: String!')
		expect(statisticsQuery).toMatch(/allStatistics: recordStatistics\(\s*first: 0/)
		expect(statisticsQuery).toMatch(/v6Statistics: recordStatistics\(\s*first: 0/)
		expect(statisticsQuery).toContain(
			'modVersion: { greaterThanOrEqualTo: $minimumModVersion }',
		)
	})

	it('keeps a rolling year baseline and appends current values', () => {
		const now = new Date('2026-07-14T12:00:00.000Z')
		const window = getUserCareerHistoryWindow(now)
		expect(window.since).toBe('2025-07-14T12:00:00.000Z')
		const history = buildUserCareerHistory({
			baseline: {
				dateCreated: '2025-07-01T00:00:00.000Z',
				points: 100,
				totalPoints: 200,
				rank: -1,
			},
			groups: [
				{
					keys: ['2026-01-01T00:00:00.000Z'],
					max: { points: 150, totalPoints: 300 },
					min: { rank: 25 },
				},
			],
			current: { points: 175, totalPoints: 350, rank: 20 },
			since: window.since,
			now: window.now,
		})
		expect(history).toEqual([
			{
				date: window.since,
				rankedPoints: 100,
				totalPoints: 200,
				rank: null,
			},
			{
				date: '2026-01-01T00:00:00.000Z',
				rankedPoints: 150,
				totalPoints: 300,
				rank: 25,
			},
			{
				date: window.now,
				rankedPoints: 175,
				totalPoints: 350,
				rank: 20,
			},
		])
	})
})
