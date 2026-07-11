import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeMyRecordView } from '../../app/utils/myRecords'

describe('personal record views', () => {
	it('accepts supported views', () => {
		expect(normalizeMyRecordView('recent')).toBe('recent')
		expect(normalizeMyRecordView('personal-bests')).toBe('personal-bests')
		expect(normalizeMyRecordView('world-records')).toBe('world-records')
	})

	it('falls back to recent for invalid query values', () => {
		expect(normalizeMyRecordView(undefined)).toBe('recent')
		expect(normalizeMyRecordView('fastest')).toBe('recent')
		expect(normalizeMyRecordView(['world-records'])).toBe('recent')
	})

	it('uses exact cursor page size and mutually exclusive PB filters', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useMyRecords.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain("useCursorPagination(25, 'myRecords')")
		expect(composable).toContain('personalBestGlobalsExist: true')
		expect(composable).toContain('worldRecordGlobalsExist: false')
		expect(composable).toContain('worldRecordGlobalsExist: true')
	})

	it('keeps row and level-link navigation independent', () => {
		const component = readFileSync(
			new URL('../../app/components/record/MyRecordTable.vue', import.meta.url),
			'utf8',
		)
		expect(component).toContain('@click="$emit(\'select\', record.id)"')
		expect(component).toContain('@keydown.enter.prevent')
		expect(component).toContain('@keydown.space.prevent')
		expect(component).toContain('@click.stop')
	})
})
