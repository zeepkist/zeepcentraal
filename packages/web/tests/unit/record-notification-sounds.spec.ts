import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	RECORD_NOTIFICATION_TONES,
	selectRecordNotificationKind,
} from '../../app/utils/recordNotification'

const composable = readFileSync(
	new URL('../../app/composables/useRecordNotificationSounds.ts', import.meta.url),
	'utf8',
)
const controls = readFileSync(
	new URL('../../app/components/record/RecordLiveControls.vue', import.meta.url),
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

describe('record notification sounds', () => {
	it('chooses exactly one highest-priority sound per update', () => {
		expect(selectRecordNotificationKind([{ userId: 1, pbOrWr: null }])).toBe('record')
		expect(
			selectRecordNotificationKind([
				{ userId: 1, pbOrWr: null },
				{ userId: 2, pbOrWr: 'personal-best' },
			]),
		).toBe('personal-best')
		expect(
			selectRecordNotificationKind([
				{ userId: 1, pbOrWr: 'personal-best' },
				{ userId: 2, pbOrWr: 'world-record' },
			]),
		).toBe('world-record')
		expect(selectRecordNotificationKind([])).toBeNull()
	})

	it('filters to viewer records before selecting priority', () => {
		const records = [
			{ userId: 1, pbOrWr: 'world-record' as const },
			{ userId: 2, pbOrWr: 'personal-best' as const },
		]
		expect(selectRecordNotificationKind(records, 2)).toBe('personal-best')
		expect(selectRecordNotificationKind(records, 3)).toBeNull()
		expect(
			selectRecordNotificationKind(
				[
					{ userId: 1, pbOrWr: 'world-record' },
					{ userId: 2, pbOrWr: null },
				],
				2,
			),
		).toBe('record')
	})

	it('defines distinct plain, PB, and WR tone sequences', () => {
		expect(RECORD_NOTIFICATION_TONES.record).toHaveLength(1)
		expect(RECORD_NOTIFICATION_TONES['personal-best']).toHaveLength(2)
		expect(RECORD_NOTIFICATION_TONES['world-record']).toHaveLength(3)
	})

	it('persists opt-in preferences and keeps audio client-only', () => {
		expect(composable).toContain("useState('record-notification-sound-enabled', () => false)")
		expect(composable).toContain("useState('record-notification-only-mine', () => false)")
		expect(composable).toContain('localStorage.setItem')
		expect(composable).toContain('if (!import.meta.client) return null')
		expect(composable).toContain('if (!import.meta.client) return')
		expect(composable).toContain('new AudioContext()')
	})

	it('shows viewer-only control only on authenticated global records', () => {
		expect(controls).toContain('v-if="showOnlyMine"')
		expect(controls).toContain(':aria-pressed="soundEnabled"')
		expect(globalPage).toContain(':show-only-mine="Boolean(session.user)"')
		expect(globalPage).toContain('allowOnlyMine: true')
		expect(personalPage).not.toContain('show-only-mine')
	})
})
