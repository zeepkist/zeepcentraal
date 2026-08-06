import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { steamProfileUrl, steamWorkshopProfileUrl } from '../../app/utils/steamProfile'
import {
	buildUserCareerHistory,
	buildUserCareerSecondaryHistory,
	createUserCareerAxisFormatter,
	getUserCareerHistoryWindow,
} from '../../app/utils/userCareerHistory'
import { getUserTelemetryWindows } from '../../app/utils/userTelemetry'

const profileQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/userProfile.graphql', import.meta.url),
	'utf8',
)
const historyQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/userPointsHistory.graphql', import.meta.url),
	'utf8',
)
const secondaryHistoryQuery = readFileSync(
	new URL(
		'../../../graphql/documents/web/queries/userPointsHistorySecondary.graphql',
		import.meta.url,
	),
	'utf8',
)
const profileComposable = readFileSync(
	new URL('../../app/composables/useUserProfile.ts', import.meta.url),
	'utf8',
)
const careerComposable = readFileSync(
	new URL('../../app/composables/useUserCareer.ts', import.meta.url),
	'utf8',
)
const summaryComposable = readFileSync(
	new URL('../../app/composables/useUserProfileSummary.ts', import.meta.url),
	'utf8',
)
const statisticsQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/userStatistics.graphql', import.meta.url),
	'utf8',
)
const page = readFileSync(
	new URL('../../app/pages/user/[steamid].vue', import.meta.url),
	'utf8',
).replaceAll('<Lazy', '<')
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
const chartSeriesTabs = readFileSync(
	new URL('../../app/components/common/ChartSeriesTabs.vue', import.meta.url),
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
		expect(page).toContain('await summaryData.prefetchCritical()')
		expect(profileComposable).not.toContain('if (!import.meta.server) return')
		expect(summaryComposable).toContain('await profile')
		expect(careerComposable).toContain('!careerPrefetch.active.value')
		expect(page).toContain(':pending="profilePending"')
		expect(page).toContain('data.profile.data.value === undefined')
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

	it('splits SSR career history from post-hydration series', () => {
		expect(historyQuery).toContain('baseline: userPointsHistories(')
		expect(historyQuery).toContain('first: 1')
		expect(historyQuery).toContain('history: userPointsHistories(')
		expect(historyQuery).toContain('first: 0')
		expect(historyQuery).toContain('groupedAggregates(groupBy: [DATE_CREATED])')
		expect(historyQuery).not.toContain('totalPoints')
		expect(historyQuery).not.toContain('worldRecords')
		expect(secondaryHistoryQuery).toContain('totalPoints')
		expect(secondaryHistoryQuery).toContain('worldRecords')
		expect(careerComposable).toContain('import.meta.server ||')
		expect(careerComposable).toContain('function activateCareerSecondary()')
		expect(careerComposable).not.toContain('pointsHistoryQuery.executeQuery()')
		expect(careerComposable).toContain('secondaryPointsHistoryReady')
		expect(page).toContain(':secondary-ready="data.secondaryPointsHistoryReady.value"')
		expect(page).toContain('@activate-secondary="data.activateCareerSecondary"')
		expect(page).not.toContain('pointsHistoryActive')
		expect(page).not.toContain('worldRecordsActive')
		expect(page).toContain(':pending="pointsHistoryPending"')
		expect(page).toContain('data.pointsHistoryQuery.data.value === undefined')
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

	it('combines career series into two accessible toggleable charts', () => {
		expect(careerHistory).toContain("ref<PointsSeries>('rankedPoints')")
		expect(careerHistory).toContain("ref<StandingSeries>('rank')")
		expect(careerHistory).toContain("key: 'worldRecords'")
		expect(careerHistory).toContain('props.secondaryHistory.map')
		expect(careerHistory).not.toContain('disabled: !props.secondaryReady')
		expect(careerHistory).toContain("emit('activate-secondary')")
		expect(careerHistory).toContain('inverted: false')
		expect(careerHistory.match(/group: 'points'/g)).toHaveLength(2)
		expect(careerHistory.match(/group: 'standing'/g)).toHaveLength(2)
		expect(chartSeriesTabs).toContain('role="tablist"')
		expect(chartSeriesTabs).toContain('role="tab"')
		expect(chartSeriesTabs).toContain(':aria-selected=')
		expect(chartSeriesTabs).toContain(':disabled="mounted && option.disabled"')
		expect(chartSeriesTabs).toContain('if (!option.disabled)')
		expect(chartSeriesTabs).not.toContain('useQuery')
	})

	it('abbreviates axis values while retaining full tooltip values', () => {
		const compact = createUserCareerAxisFormatter('en')
		expect(compact.format(1_000)).toBe('1K')
		expect(compact.format(1_050)).toBe('1.05K')
		expect(compact.format(1_000_000)).toBe('1M')
		expect(compact.format(1_450_000)).toBe('1.45M')
		expect(compact.format(4_000_000_000)).toBe('4B')
		expect(careerHistory).toContain('createUserCareerAxisFormatter(locale.value)')
		expect(careerHistory).toContain('series.inverted ? formatRankTick : formatCompactTick')
		expect(careerHistory).toContain('number.value.format(displayValue)')
	})

	it('reserves chart height while the SSR response hydrates', () => {
		expect(careerHistory).toContain('class="relative h-[220px]"')
		expect(careerHistory).toContain(
			'v-if="!hydrated || (series.secondary && secondaryPending)"',
		)
		expect(careerHistory).toContain('name="loader-2"')
		expect(careerHistory).toContain('motion-safe:animate-spin')
		expect(careerHistory).toContain('role="status"')
		expect(careerHistory).toContain('v-else')
		expect(page).toContain("loading: t('common.loading')")
	})

	it('renders profile sections in their requested tab groups', () => {
		const career = ['profile-history', 'profile-telemetry'].map((id) =>
			page.indexOf(`id="${id}"`),
		)
		const records = ['profile-world-records', 'profile-personal-bests', 'profile-recent'].map(
			(id) => page.indexOf(`id="${id}"`),
		)
		const workshop = ['profile-popular-levels', 'profile-recent-levels'].map((id) =>
			page.indexOf(`id="${id}"`),
		)
		expect(career).toEqual([...career].sort((left, right) => left - right))
		expect(records).toEqual([...records].sort((left, right) => left - right))
		expect(workshop).toEqual([...workshop].sort((left, right) => left - right))
		expect(page).toContain('<template #career>')
		expect(page).toContain('<template #records>')
		expect(page).toContain('<template #workshop>')
		expect(page).toContain('id="profile-world-records"')
		expect(page.indexOf(':ref="data.levelsTarget"')).toBeLessThan(
			page.indexOf('id="profile-popular-levels"'),
		)
	})

	it('places a separate voting distribution section after cosmetics', () => {
		const cosmeticsIndex = page.indexOf('id="profile-cosmetics"')
		const votesIndex = page.indexOf('id="profile-voting-distribution"')

		expect(cosmeticsIndex).toBeGreaterThan(-1)
		expect(votesIndex).toBeGreaterThan(cosmeticsIndex)
		expect(page).toContain('<VoteDistributionChart')
		expect(page).toContain(':counts="data.voteDistribution.value"')
	})

	it('offers request-free all-time, daily, monthly, and yearly telemetry periods', () => {
		expect(telemetrySelect).not.toContain('useQuery')
		expect(page).toContain("value: 'all-time'")
		expect(page).toContain("value: 'today'")
		expect(page).toContain("value: 'month'")
		expect(page).toContain("value: 'year'")
		expect(page).toContain("getDateTimeFormatter(locale.value, 'month-london')")
		expect(page).toContain("getDateTimeFormatter(locale.value, 'year-london')")
	})

	it('keeps a rolling year baseline and appends current values', () => {
		const now = new Date('2026-07-14T12:00:00.000Z')
		const window = getUserCareerHistoryWindow(now)
		expect(window.since).toBe('2025-07-14T12:00:00.000Z')
		const history = buildUserCareerHistory({
			baseline: {
				dateCreated: '2025-07-01T00:00:00.000Z',
				points: 100,
				rank: -1,
			},
			groups: [
				{
					keys: ['2026-01-01T00:00:00.000Z'],
					max: { points: 150 },
					min: { rank: 25 },
				},
			],
			current: { points: 175, rank: 20 },
			since: window.since,
			now: window.now,
		})
		expect(history).toEqual([
			{
				date: window.since,
				rankedPoints: 100,
				rank: null,
			},
			{
				date: '2026-01-01T00:00:00.000Z',
				rankedPoints: 150,
				rank: 25,
			},
			{
				date: window.now,
				rankedPoints: 175,
				rank: 20,
			},
		])

		expect(
			buildUserCareerSecondaryHistory({
				baseline: {
					dateCreated: '2025-07-01T00:00:00.000Z',
					totalPoints: 200,
					worldRecords: 0,
				},
				groups: [
					{
						keys: ['2026-01-01T00:00:00.000Z'],
						max: { totalPoints: 300, worldRecords: 3 },
					},
				],
				current: { totalPoints: 350, worldRecords: 2 },
				since: window.since,
				now: window.now,
			}),
		).toEqual([
			{ date: window.since, totalPoints: 200, worldRecords: 0 },
			{ date: '2026-01-01T00:00:00.000Z', totalPoints: 300, worldRecords: 3 },
			{ date: window.now, totalPoints: 350, worldRecords: 2 },
		])
	})
})
