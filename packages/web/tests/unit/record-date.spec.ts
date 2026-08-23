import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	getRecordDatePrimaryPercentage,
	OLD_RECORD_AGE_MS,
	RECENT_RECORD_AGE_MS,
} from '../../app/utils/recordDate'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('record date highlighting', () => {
	const now = Date.parse('2026-08-23T12:00:00.000Z')

	it('keeps recent and future records at full primary colour', () => {
		expect(getRecordDatePrimaryPercentage(now + 1, now)).toBe(100)
		expect(getRecordDatePrimaryPercentage(new Date(now), now)).toBe(100)
		expect(getRecordDatePrimaryPercentage(now - RECENT_RECORD_AGE_MS, now)).toBe(100)
	})

	it('linearly mixes records between thirty minutes and one year', () => {
		const midpointAge = RECENT_RECORD_AGE_MS + (OLD_RECORD_AGE_MS - RECENT_RECORD_AGE_MS) / 2
		expect(getRecordDatePrimaryPercentage(now - midpointAge, now)).toBe(50)
	})

	it('uses foreground for one-year-old, older, or invalid dates', () => {
		expect(getRecordDatePrimaryPercentage(now - OLD_RECORD_AGE_MS, now)).toBe(0)
		expect(getRecordDatePrimaryPercentage(now - OLD_RECORD_AGE_MS - 1, now)).toBe(0)
		expect(getRecordDatePrimaryPercentage('invalid', now)).toBe(0)
	})

	it('renders compact relative and full date modes with age colour', () => {
		const component = read('../../app/components/record/RecordDate.vue')
		const clock = read('../../app/composables/useRecordDateNow.ts')
		expect(component).toContain('<script setup vapor lang="ts">')
		expect(component).toContain('showFullDate?: boolean')
		expect(component).toContain('showFullDate: false')
		expect(component).toContain('v-if="showFullDate"')
		expect(component).toContain('date-style="medium"')
		expect(component).toContain('time-style="short"')
		expect(component).toContain('numeric="auto"')
		expect(component).toContain('relative-style="short"')
		expect(component).toContain('useRecordDateNow()')
		expect(clock).toContain('createSharedComposable')
		expect(clock).toContain('useIntervalFn(update, 60_000)')
		expect(component).toContain(
			`color-mix(in oklab, var(--primary) \${primaryPercentage}%, var(--foreground))`,
		)
	})

	it('is used by both requested leaderboard tables', () => {
		const tournament = read('../../app/components/tournament/TournamentLeaderboardTable.vue')
		const history = read('../../app/components/record/RecordHistoryTable.vue')

		expect(tournament).toContain(
			'<RecordDate v-if="row.setAt" :datetime="row.setAt" :show-full-date="!active" />',
		)
		expect(tournament).toContain("$t('common.unavailable')")
		expect(history).toContain('<RecordDate :datetime="record.dateCreated" />')
		expect(history).not.toContain('<NuxtTime')
	})
})
