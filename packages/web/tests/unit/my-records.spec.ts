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
		expect(recordHistoryFilter('recent', 'latest')).toEqual({
			historyView: { equalTo: 'recent' },
		})
		expect(recordHistoryFilter('personal-bests', 'latest', 42)).toEqual({
			historyView: { equalTo: 'personal-bests' },
			userId: { equalTo: 42 },
		})
		expect(recordHistoryFilter('world-records', 'latest')).toEqual({
			historyView: { equalTo: 'world-records' },
		})
	})

	it('uses deterministic latest and contribution value ordering', () => {
		expect(recordHistoryOrder('latest')).toEqual(['DATE_CREATED_DESC', 'ID_DESC'])
		expect(recordHistoryOrder('valuable-levels')).toEqual([
			'LEVEL_POINTS_DESC',
			'DATE_CREATED_DESC',
			'ID_DESC',
		])
		expect(recordHistoryOrder('valuable-pbs')).toEqual([
			'PLAYER_DECAYED_POINTS_DESC',
			'DATE_CREATED_DESC',
			'ID_DESC',
		])
		expect(recordHistoryFilter('recent', 'valuable-levels')).toEqual({
			historyView: { equalTo: 'recent' },
			hasContribution: { equalTo: true },
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
		expect(query).toContain('records(first: 0, filter: { userId: { equalTo: $id } })')
		expect(query).not.toContain('user(id: $id)')
		expect(query).toContain('$first: Int')
		expect(query).toContain('$after: Cursor')
		expect(query).toContain('$orderBy: [RecordHistoryEntriesOrderBy!]!')
		expect(query).toContain('recordHistoryEntries(')
		expect(query).toContain('orderBy: $orderBy')
		expect(query).toContain('contributionRank')
		expect(query).toContain('levelPoints')
	})

	it('maps level and global points with independent decay inputs', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain('levelPoints: node.levelPoints')
		expect(composable).toContain('levelDecayedPoints: node.levelDecayedPoints')
		expect(composable).toContain('playerDecayedPoints: node.playerDecayedPoints')
		expect(composable).toContain(
			'calculateDecayMultiplier(node.levelPosition, LEVEL_DECAY_FACTOR)',
		)
		expect(composable).toContain('node.contributionRank,')
		expect(composable).toContain('GLOBAL_DECAY_FACTOR,')
	})

	it('formats localized decay percentages with precise tooltip support', () => {
		expect(createDecayPercentageFormatter('en-GB').format(0.985)).toBe('98.5%')
		expect(createDecayPercentageFormatter('en-GB', 3, 3).format(0.985)).toBe('98.500%')
	})

	it('keeps fixed columns with optional status and independent row/level navigation', () => {
		const component = readFileSync(
			new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
			'utf8',
		)
		const cellLink = readFileSync(
			new URL('../../app/components/common/DataTableCellLink.vue', import.meta.url),
			'utf8',
		)
		expect(component).toContain('table-fixed')
		expect(component).toContain('min-w-[48rem]')
		expect(component).toContain('v-for="column in columns"')
		expect(component).toContain('getRecordHistoryColumns({')
		expect(component).toContain('showStatus: showStatus.value')
		expect(component).toContain('record.levelDecayedPoints')
		expect(component).toContain('record.playerDecayedPoints')
		expect(component).toContain(':to="levelPath(record)"')
		expect(component).toContain(':to="playerOrRecordPath(record)"')
		expect(component).toContain(':to="recordPath(record)"')
		expect(component).not.toContain('defineEmits')
		expect(component).not.toContain('@click')
		expect(component).not.toContain('@keydown')
		expect(cellLink).toContain('<NuxtLink')
		expect(cellLink).toContain(':tabindex="focusable ? undefined : -1"')
		expect(cellLink).not.toContain('@click')
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
		expect(table).toContain("column === 'player'")
		expect(table).toContain('showPlayer?: boolean')
		expect(table).toContain('record.userSteamId')
		expect(page).toContain('<template #actions>')
		expect(page).toContain('<UButton v-if="session.user"')
		expect(page).toContain('to="/records/me"')
		expect(page).toContain('show-player')
	})

	it('shows setup prompt from explicit zero-record count state', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useMyRecords.ts', import.meta.url),
			'utf8',
		)
		const page = readFileSync(
			new URL('../../app/pages/records/me.vue', import.meta.url),
			'utf8',
		)
		expect(composable).toContain('countResult.data.value?.records?.totalCount === 0')
		expect(page).toContain('v-if="data.hasNoRecords.value"')
		expect(page).not.toContain('data.totalRecords.value')
	})

	it('uses global record copy for shared personal history controls', () => {
		const page = readFileSync(
			new URL('../../app/pages/records/me.vue', import.meta.url),
			'utf8',
		)
		expect(page).toContain('pages.records.tabs')
		expect(page).toContain('pages.records.sort')
		expect(page).toContain('pages.records.table')
		expect(page).toContain('pages.records.empty')
		expect(page).not.toContain('pages.myRecords.tabs')
		expect(page).not.toContain('pages.myRecords.sort')
		expect(page).not.toContain('pages.myRecords.table')
	})

	it('highlights viewer rows only on global record history', () => {
		const table = readFileSync(
			new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
			'utf8',
		)
		const row = readFileSync(
			new URL('../../app/components/common/DataTableRow.vue', import.meta.url),
			'utf8',
		)
		const globalPage = readFileSync(
			new URL('../../app/pages/records/index.vue', import.meta.url),
			'utf8',
		)
		const personalPage = readFileSync(
			new URL('../../app/pages/records/me.vue', import.meta.url),
			'utf8',
		)
		expect(table).toContain('viewerUserId === record.userId')
		expect(table).toContain(':highlighted="highlightedRecordIds?.has(record.id)"')
		expect(row).toContain("viewer ? 'bg-primary/10 text-highlighted' : 'bg-card/60'")
		expect(row).toContain("'record-history-highlight': highlighted")
		expect(globalPage).toContain(':viewer-user-id="session.user?.id"')
		expect(personalPage).not.toContain('viewer-user-id')
		expect(globalPage).not.toContain('@select')
		expect(personalPage).not.toContain('@select')
	})
})
