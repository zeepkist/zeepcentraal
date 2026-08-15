import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { steamWorkshopItemUrl } from '../../app/utils/steamWorkshop'

const query = readFileSync(
	new URL('../../../graphql/documents/web/queries/levelDetail.graphql', import.meta.url),
	'utf8',
)
const historyQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/levelPointsHistory.graphql', import.meta.url),
	'utf8',
)
const page = readFileSync(
	new URL('../../app/pages/level/[xxh128].vue', import.meta.url),
	'utf8',
).replaceAll('<Lazy', '<')
const hero = readFileSync(
	new URL('../../app/components/level/LevelDetailHero.vue', import.meta.url),
	'utf8',
)

describe('level detail hero', () => {
	it('loads workshop, author, rating, points, and world-record track length data', () => {
		expect(query).toContain('authorId')
		expect(query).toContain('workshopId')
		expect(query).toContain('levelPoints {')
		expect(query).toContain('rating')
		expect(query).toContain('votes(first: 0)')
		expect(query).not.toContain('modifierCompetitiveness')
		expect(query).toContain('recordStatistic {')
		expect(query).toContain('distance')
		expect(query).toContain('trackTournaments(')
		expect(query).toContain('first: 2')
		expect(query).toContain('startAt: { lessThanOrEqualTo: $now }')
		expect(query).toContain('orderBy: [TYPE_ASC]')
		expect(query).not.toMatch(/^\s*hash\s*$/m)
	})

	it('queries bounded grouped point history with a single baseline row', () => {
		expect(historyQuery).toContain('baseline: levelPointsHistories(')
		expect(historyQuery).toContain('first: 1')
		expect(historyQuery).toContain('history: levelPointsHistories(')
		expect(historyQuery).toContain('first: 0')
		expect(historyQuery).toContain('groupedAggregates(groupBy: [DATE_CREATED])')
	})

	it('renders critical detail through the reusable hero without exposing level hash', () => {
		expect(page).toContain('await levelData.prefetchCritical()')
		expect(page).toContain('<LevelDetailHero')
		expect(page).toContain(':author-id="summary.authorId"')
		expect(hero).not.toContain('xxHash')
		expect(hero).toContain('target="_blank"')
		expect(hero).toContain('rel="noopener"')
		expect(hero).not.toContain('competitiveness')
		expect(hero).toContain('worldRecord.dateCreated')
		expect(hero).toContain('formatRating(props.level.rating, props.level.voteCount)')
		expect(hero).not.toContain('min-h-80')
		expect(hero).toContain('flex flex-wrap items-center gap-3')
	})

	it('builds canonical Steam Workshop item links', () => {
		expect(steamWorkshopItemUrl('123456')).toBe(
			'https://steamcommunity.com/sharedfiles/filedetails/?id=123456',
		)
		expect(steamWorkshopItemUrl(undefined)).toBeUndefined()
		expect(steamWorkshopItemUrl('not-an-id')).toBeUndefined()
	})
})
