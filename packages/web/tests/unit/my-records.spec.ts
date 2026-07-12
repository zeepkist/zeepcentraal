import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDecayPercentageFormatter } from '../../app/utils/decayPercentage'
import {
	normalizeRecordHistorySort,
	normalizeRecordHistoryView,
	recordHistoryFilter,
	recordHistoryOrder,
} from '../../app/utils/recordHistory'

describe('record history', () => {
	it('normalizes URL-backed views and sorts', () => {
		expect(normalizeRecordHistoryView('personal-bests')).toBe('personal-bests')
		expect(normalizeRecordHistoryView('world-records')).toBe('world-records')
		expect(normalizeRecordHistoryView('fastest')).toBe('recent')
		expect(normalizeRecordHistorySort('valuable-levels')).toBe('valuable-levels')
		expect(normalizeRecordHistorySort('valuable-pbs')).toBe('valuable-pbs')
		expect(normalizeRecordHistorySort('unknown')).toBe('latest')
	})

	it('includes world records in the personal best view', () => {
		expect(recordHistoryFilter('personal-bests', 'latest', 42)).toEqual({
			userId: { equalTo: 42 },
			personalBestGlobalsExist: true,
		})
		expect(recordHistoryFilter('world-records', 'latest')).toEqual({
			worldRecordGlobalsExist: true,
		})
	})

	it('uses deterministic latest and contribution value ordering', () => {
		expect(recordHistoryOrder('latest')).toEqual(['DATE_CREATED_DESC', 'ID_DESC'])
		expect(recordHistoryOrder('valuable-levels')).toEqual([
			'USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POINTS_DESC',
			'DATE_CREATED_DESC',
			'ID_DESC',
		])
		expect(recordHistoryOrder('valuable-pbs')).toEqual([
			'USER_POINT_CONTRIBUTIONS_MAX_PLAYER_DECAYED_POINTS_DESC',
			'DATE_CREATED_DESC',
			'ID_DESC',
		])
		expect(recordHistoryFilter('recent', 'valuable-levels')).toEqual({
			userPointContributionsExist: true,
		})
	})

	it('uses exact cursor page size and query-supplied ordering', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		const query = readFileSync(
			new URL('../../app/graphql/queries/recordHistory.graphql', import.meta.url),
			'utf8',
		)
		expect(composable).toContain('useCursorPagination(25, options.namespace)')
		expect(query).toContain('$first: Int')
		expect(query).toContain('$after: Cursor')
		expect(query).toContain('$orderBy: [RecordsOrderBy!]!')
		expect(query).toContain('orderBy: $orderBy')
		expect(query).toContain('contributionRank')
		expect(query).toContain('levelPoints')
	})

	it('maps level and global points with independent decay inputs', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain('levelPoints: contribution?.levelPoints')
		expect(composable).toContain('levelDecayedPoints: contribution?.levelDecayedPoints')
		expect(composable).toContain('playerDecayedPoints: contribution?.playerDecayedPoints')
		expect(composable).toContain(
			'calculateDecayMultiplier(contribution.levelPosition, LEVEL_DECAY_FACTOR)',
		)
		expect(composable).toContain('contribution.contributionRank,')
		expect(composable).toContain('GLOBAL_DECAY_FACTOR,')
	})

	it('formats localized decay percentages with precise tooltip support', () => {
		expect(createDecayPercentageFormatter('en-GB').format(0.985)).toBe('98.5%')
		expect(createDecayPercentageFormatter('en-GB', 3, 3).format(0.985)).toBe('98.500%')
	})

	it('keeps seven fixed columns and independent row/level navigation', () => {
		const component = readFileSync(
			new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
			'utf8',
		)
		expect(component).toContain('table-fixed')
		expect(component).toContain('min-w-[64rem]')
		expect(component.match(/<col(?:\s|\/)/g)).toHaveLength(8)
		expect(component).toContain('<col />')
		expect(component).toContain('record.levelPoints')
		expect(component).toContain('record.levelDecayedPoints')
		expect(component).toContain('record.playerDecayedPoints')
		expect(component).toContain('@click="$emit(\'select\', record.id)"')
		expect(component).toContain('@keydown.enter.prevent')
		expect(component).toContain('@keydown.space.prevent')
		expect(component).toContain('@click.stop')
	})

	it('renders linked players globally and a personal-history action for authenticated users', () => {
		const table = readFileSync(
			new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
			'utf8',
		)
		const page = readFileSync(
			new URL('../../app/pages/records/index.vue', import.meta.url),
			'utf8',
		)
		expect(table).toContain('v-if="showPlayer"')
		expect(table).toContain('record.userSteamId')
		expect(page).toContain('<template v-if="session.user" #actions>')
		expect(page).toContain('to="/records/me"')
		expect(page).toContain('show-player')
	})
})
