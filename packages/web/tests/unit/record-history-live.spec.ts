import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getNewRecordIds, recordHistoryFilter } from '../../app/utils/recordHistory'

describe('live record history', () => {
	it('uses same inclusive view filters as static history', () => {
		expect(recordHistoryFilter('personal-bests', 'latest', 42)).toEqual({
			userId: { equalTo: 42 },
			personalBestGlobalsExist: true,
		})
	})

	it('requests exactly one latest cursor-free page', () => {
		const subscription = readFileSync(
			new URL('../../app/graphql/subscriptions/recordHistoryLive.graphql', import.meta.url),
			'utf8',
		)
		expect(subscription).toContain('records(first: 25')
		expect(subscription).toContain('orderBy: [DATE_CREATED_DESC, ID_DESC]')
		expect(subscription).not.toContain('after:')
		expect(subscription).not.toContain('before:')
		expect(subscription).toContain('...ZC_RecordHistoryRow')
	})

	it('activates only after mount for Latest on first page with static data', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useRecordHistory.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain("options.sort.value === 'latest'")
		expect(composable).toContain('pagination.isFirstPage.value')
		expect(composable).toContain('result.data.value?.records !== undefined')
		expect(composable).toContain('onMounted(() =>')
		expect(composable).toContain('import.meta.server || !liveEnabled.value')
		expect(composable).toContain('liveSnapshot.value')
	})

	it('detects only newly introduced IDs', () => {
		expect(getNewRecordIds(new Set([1, 2, 3]), [4, 3, 2])).toEqual([4])
		expect(getNewRecordIds(new Set(), [5, 6])).toEqual([5, 6])
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
		expect(composable).toContain('}, 2_000)')
		expect(composable).toContain('onScopeDispose(clearHighlights)')
		expect(css).toContain('@keyframes record-history-highlight')
		expect(css).toContain('@media (prefers-reduced-motion: reduce)')
	})
})
