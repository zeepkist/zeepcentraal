import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	getNewRecordIds,
	getRecordResultStatus,
	recordHistoryFilter,
} from '../../app/utils/recordHistory'

describe('live record history', () => {
	it('uses same inclusive view filters as static history', () => {
		expect(recordHistoryFilter('personal-bests', 'latest', 42)).toEqual({
			historyView: { equalTo: 'personal-bests' },
			userId: { equalTo: 42 },
		})
	})

	it('requests exactly one latest cursor-free page', () => {
		const subscription = readFileSync(
			new URL('../../app/graphql/subscriptions/recordHistoryLive.graphql', import.meta.url),
			'utf8',
		)
		expect(subscription).toContain('recordHistoryEntries(first: 25')
		expect(subscription).toContain('orderBy: [DATE_CREATED_DESC, ID_DESC]')
		expect(subscription).not.toContain('after:')
		expect(subscription).not.toContain('before:')
		expect(subscription).toContain('...ZC_RecordHistoryRow')
		const query = readFileSync(
			new URL('../../app/graphql/queries/recordHistory.graphql', import.meta.url),
			'utf8',
		)
		expect(query).toContain('isPersonalBest')
		expect(query).toContain('isWorldRecord')
		expect(query.slice(query.indexOf('query ZC_RecordHistory('))).not.toContain('totalCount')
	})

	it('activates only after mount for Latest on first page with static data', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain("options.sort.value === 'latest'")
		expect(composable).toContain('pagination.isFirstPage.value')
		expect(composable).toContain('result.data.value?.recordHistoryEntries !== undefined')
		expect(composable).toContain('onMounted(() =>')
		expect(composable).toContain('import.meta.server || !liveEnabled.value')
		expect(composable).toContain('liveSnapshot.value')
	})

	it('detects only newly introduced IDs', () => {
		expect(getNewRecordIds(new Set([1, 2, 3]), [4, 3, 2])).toEqual([4])
		expect(getNewRecordIds(new Set(), [5, 6])).toEqual([5, 6])
	})

	it('maps current record status with world-record precedence', () => {
		expect(getRecordResultStatus(0, 0)).toBeNull()
		expect(getRecordResultStatus(1, 0)).toBe('personal-best')
		expect(getRecordResultStatus(1, 1)).toBe('world-record')
	})

	it('renders and clears highlighted rows with reduced-motion support', () => {
		const table = readFileSync(
			new URL('../../app/components/record/RecordHistoryTable.vue', import.meta.url),
			'utf8',
		)
		const row = readFileSync(
			new URL('../../app/components/common/DataTableRow.vue', import.meta.url),
			'utf8',
		)
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		const css = readFileSync(
			new URL('../../app/assets/css/tailwind.css', import.meta.url),
			'utf8',
		)
		expect(table).toContain(':highlighted="highlightedRecordIds?.has(record.id)"')
		expect(row).toContain("'record-history-highlight': highlighted")
		expect(table).toContain('aria-live="polite"')
		expect(composable).toContain('}, 10_000)')
		expect(composable).toContain('onScopeDispose(clearHighlights)')
		expect(css).toContain('@keyframes record-history-highlight')
		expect(css).toContain('animation: record-history-highlight 10s')
		expect(css).toContain('@media (prefers-reduced-motion: reduce)')
	})

	it('reports connecting, live, paused, and error states to request-free controls', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		const controls = readFileSync(
			new URL('../../app/components/record/RecordLiveControls.vue', import.meta.url),
			'utf8',
		)
		expect(composable).toContain('const liveEligible = computed(')
		expect(composable).toContain('const liveReady = computed(')
		expect(composable).toContain("return 'error' as const")
		expect(controls).toContain("status === 'live' ? 'success' : 'neutral'")
		expect(controls).toContain('animate-ping')
		expect(controls).toContain('motion-reduce:animate-none')
		expect(controls).not.toContain('useQuery')
	})
})
