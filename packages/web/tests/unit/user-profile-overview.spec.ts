import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { steamProfileUrl, steamWorkshopProfileUrl } from '../../app/utils/steamProfile'
import {
	buildUserCareerHistory,
	getUserCareerHistoryWindow,
} from '../../app/utils/userCareerHistory'
import { getUserTelemetryWindows } from '../../app/utils/userTelemetry'

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
const careerHistory = readFileSync(
	new URL('../../app/components/user/UserCareerHistory.vue', import.meta.url),
	'utf8',
)
const telemetrySelect = readFileSync(
	new URL('../../app/components/record/RecordTelemetryPeriodSelect.vue', import.meta.url),
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

	it('queries one baseline and grouped history', () => {
		expect(historyQuery).toContain('baseline: userPointsHistories(')
		expect(historyQuery).toContain('first: 1')
		expect(historyQuery).toContain('history: userPointsHistories(')
		expect(historyQuery).toContain('first: 0')
		expect(historyQuery).toContain('groupedAggregates(groupBy: [DATE_CREATED])')
	})

	it('queries count-only telemetry for all supported periods', () => {
		expect(statisticsQuery).toContain('$minimumModVersion: String!')
		expect(statisticsQuery).toContain('$daySince: Datetime!')
		expect(statisticsQuery).toContain('$monthSince: Datetime!')
		expect(statisticsQuery).toContain('$yearSince: Datetime!')
		for (const alias of [
			'allStatistics',
			'dayStatistics',
			'monthStatistics',
			'yearStatistics',
			'v6Statistics',
			'v6DayStatistics',
			'v6MonthStatistics',
			'v6YearStatistics',
		]) {
			expect(statisticsQuery).toMatch(new RegExp(`${alias}: recordStatistics\\(\\s*first: 0`))
		}
		expect(statisticsQuery).toContain(
			'modVersion: { greaterThanOrEqualTo: $minimumModVersion }',
		)
		expect(statisticsQuery.match(/totalCount/g)?.length).toBe(5)
	})

	it('uses London calendar boundaries across daylight-saving time', () => {
		const summer = getUserTelemetryWindows(new Date('2026-07-14T12:00:00.000Z'))
		expect(summer.daySince).toBe('2026-07-13T23:00:00.000Z')
		expect(summer.monthSince).toBe('2026-06-30T23:00:00.000Z')
		expect(summer.yearSince).toBe('2026-01-01T00:00:00.000Z')

		const winter = getUserTelemetryWindows(new Date('2026-01-14T12:00:00.000Z'))
		expect(winter.daySince).toBe('2026-01-14T00:00:00.000Z')
		expect(winter.monthSince).toBe('2026-01-01T00:00:00.000Z')
		expect(winter.yearSince).toBe('2026-01-01T00:00:00.000Z')
	})

	it('places full-width progression charts beside compact career summary', () => {
		expect(page).toContain('lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]')
		expect(page).toContain('<MetricGrid :metrics="metrics" :columns="2" />')
		expect(careerHistory).toContain('class="space-y-4"')
		expect(careerHistory).not.toContain('lg:grid-cols-3')
		expect(careerHistory).toContain('value: -point.rank')
		expect(careerHistory).toContain('Math.abs(value)')
	})

	it('offers request-free all-time, daily, monthly, and yearly telemetry periods', () => {
		expect(telemetrySelect).not.toContain('useQuery')
		expect(page).toContain("value: 'all-time'")
		expect(page).toContain("value: 'today'")
		expect(page).toContain("value: 'month'")
		expect(page).toContain("value: 'year'")
		expect(page).toContain('USER_TELEMETRY_TIME_ZONE')
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
