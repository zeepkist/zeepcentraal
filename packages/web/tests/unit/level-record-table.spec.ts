import { existsSync, readFileSync } from 'node:fs'
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
const viewerBestQuery = readFileSync(
	new URL('../../app/graphql/queries/levelViewerBest.graphql', import.meta.url),
	'utf8',
)
const component = readFileSync(
	new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
	'utf8',
)
const statusBadge = readFileSync(
	new URL('../../app/components/record/RecordStatusBadge.vue', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useLevelDetail.ts', import.meta.url),
	'utf8',
)
const page = readFileSync(
	new URL('../../app/pages/level/[xxh128].vue', import.meta.url),
	'utf8',
).replaceAll('<Lazy', '<')

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
		expect(recordsQuery).toContain('userPointContributions(first: 1)')
		expect(viewerBestQuery).toContain('userPointContributions(first: 1)')
		for (const field of [
			'levelPosition',
			'contributionRank',
			'levelPoints',
			'levelDecayedPoints',
			'playerDecayedPoints',
		]) {
			expect(recordsQuery).toContain(field)
			expect(viewerBestQuery).toContain(field)
		}
	})

	it('stages exact PB points, retains the viewer, and resolves missing ranks', () => {
		expect(composable).toContain(
			"orderBy: ['TIME_ASC' as RecordsOrderBy, 'ID_ASC' as RecordsOrderBy]",
		)
		expect(composable).toContain('includeStatus: true')
		expect(composable).toContain('includeStatus: false')
		expect(composable).toContain('mapped.levelDecayedPoints ??')
		expect(composable).toContain('calculateLevelPersonalBestPoints(levelPoints, rank)')
		expect(composable).toContain(
			'const personalBestRowsSource = shallowRef<RecordHistoryRow[]>([])',
		)
		expect(composable).toContain('useRecordRankFallback(personalBestRowsSource)')
		expect(composable).toContain('useRecordRankFallback(recentRowsSource)')
		expect(composable).toContain('pinned: true')
		expect(composable).not.toContain('Zc_LevelViewerRankDocument')
		expect(
			existsSync(
				new URL('../../app/graphql/queries/levelViewerRank.graphql', import.meta.url),
			),
		).toBe(false)
	})

	it('uses rank-first player tables with requested badge modes and point columns', () => {
		expect(page.match(/<RecordHistoryTable/g)).toHaveLength(2)
		expect(page.match(/rank-first/g)).toHaveLength(2)
		expect(page.match(/show-player/g)).toHaveLength(2)
		expect(page.match(/:show-level="false"/g)).toHaveLength(2)
		expect(page).toMatch(/:transition-scope="`level-personal-bests-\$\{xxHash\}`"/)
		expect(page).toMatch(/:transition-scope="`level-recent-records-\$\{xxHash\}`"/)
		expect(page.match(/show-delta/g)).toHaveLength(1)
		expect(page).toContain(':fastest-time="levelData.worldRecord.value?.time"')
		expect(page).toContain('status-mode="none"')
		expect(page).toContain('status-mode="all"')
		expect(page).toContain("points: t('common.points')")
		expect(page).toContain("rankedPoints: t('common.rankedPoints')")
		expect(component).toContain("column === 'points'")
		expect(component).toContain("column === 'rankedPoints'")
		expect(component).toContain("column === 'delta'")
		expect(component).toContain('props.showDelta && props.fastestTime !== undefined')
		expect(component).toContain('formatTournamentDelta(record.time, fastestTime)')
		expect(component).toContain('class="p-0 tabular-nums text-muted"')
		expect(component).toContain('<RecordStatusBadge')
		expect(statusBadge).toContain("status === 'world-record'")
		expect(statusBadge).toContain('color="primary"')
		expect(statusBadge).toContain("status === 'personal-best'")
		expect(statusBadge).toContain('bg-purple-500/15')
		expect(statusBadge).toContain('{{ worldRecordLabel }}')
		expect(statusBadge).toContain('{{ personalBestLabel }}')
	})
})
