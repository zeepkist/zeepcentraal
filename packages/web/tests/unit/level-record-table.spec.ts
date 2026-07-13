import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	buildLevelPersonalBestRanks,
	calculateLevelPersonalBestPoints,
	resolveRecordPbOrWr,
} from '../../app/utils/levelRecordRows'

const recordsQuery = readFileSync(
	new URL('../../app/graphql/queries/levelRecords.graphql', import.meta.url),
	'utf8',
)
const ranksQuery = readFileSync(
	new URL('../../app/graphql/queries/levelPersonalBestRanks.graphql', import.meta.url),
	'utf8',
)
const component = readFileSync(
	new URL('../../app/components/record/RecordTable.vue', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useLevelDetail.ts', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/level/[xxh128].vue', import.meta.url), 'utf8')

describe('level record tables', () => {
	it('builds exact competition ranks from a deep cursor-page aggregate window', () => {
		const ranks = buildLevelPersonalBestRanks('25', [
			{ keys: ['11'], distinctCount: { id: '1' } },
			{ keys: ['10'], distinctCount: { id: '2' } },
			{ keys: [null], distinctCount: { id: '5' } },
		])

		expect(ranks.get(10)).toBe(26)
		expect(ranks.get(11)).toBe(28)
	})

	it('calculates level-decayed points and leaves unranked levels empty', () => {
		expect(calculateLevelPersonalBestPoints(1000, 1)).toBe(1000)
		expect(calculateLevelPersonalBestPoints(1000, 2)).toBeCloseTo(985)
		expect(calculateLevelPersonalBestPoints(null, 1)).toBeNull()
		expect(calculateLevelPersonalBestPoints(1000, null)).toBeNull()
	})

	it('maps current WR before PB and omits ordinary record status', () => {
		expect(
			resolveRecordPbOrWr({
				personalBestGlobals: { totalCount: 1 },
				worldRecordGlobals: { totalCount: 1 },
			}),
		).toBe('world-record')
		expect(
			resolveRecordPbOrWr({
				personalBestGlobals: { totalCount: 1 },
				worldRecordGlobals: { totalCount: 0 },
			}),
		).toBe('personal-best')
		expect(resolveRecordPbOrWr({})).toBeNull()
	})

	it('requests only count status relations and bounded rank windows', () => {
		expect(recordsQuery).toContain('$includeStatus: Boolean!')
		expect(recordsQuery).toContain('personalBestGlobals(first: 0) @include')
		expect(recordsQuery).toContain('worldRecordGlobals(first: 0) @include')
		expect(ranksQuery.match(/first: 0/g)).toHaveLength(2)
		expect(ranksQuery).toContain('personalBestGlobalsExist: true')
		expect(ranksQuery).toContain('time: { lessThan: $minimumTime }')
		expect(ranksQuery).toContain('greaterThanOrEqualTo: $minimumTime')
		expect(ranksQuery).toContain('lessThanOrEqualTo: $maximumTime')
		expect(ranksQuery).toContain('groupedAggregates(groupBy: [TIME])')
		expect(ranksQuery).not.toContain('offset:')
	})

	it('stages exact PB points and enables each table column independently', () => {
		expect(composable).toContain(
			"orderBy: ['TIME_ASC' as RecordsOrderBy, 'ID_ASC' as RecordsOrderBy]",
		)
		expect(composable).toContain('includeStatus: true')
		expect(composable).toContain('includeStatus: false')
		expect(composable).toContain('calculateLevelPersonalBestPoints(levelPoints, rank)')
		expect(composable).toContain('const personalBestRows = shallowRef<RecordRow[]>([])')
		expect(page).toContain('show-pb-or-wr')
		expect(page).toContain('show-points')
		expect(page).toContain("pointsLabel: t('common.points')")
	})

	it('renders locale-formatted points and translated status badges', () => {
		expect(component).toContain('pointNumber.format(record.points)')
		expect(component).toContain("record.pbOrWr === 'world-record'")
		expect(component).toContain('color="primary"')
		expect(component).toContain("record.pbOrWr === 'personal-best'")
		expect(component).toContain('bg-purple-500/15')
		expect(component).toContain('{{ worldRecordLabel }}')
		expect(component).toContain('{{ personalBestLabel }}')
	})
})
