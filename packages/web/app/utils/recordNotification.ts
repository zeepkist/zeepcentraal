import type { RecordHistoryRow } from '~/types/app'

export type RecordNotificationKind = 'record' | 'personal-best' | 'world-record'

export const RECORD_NOTIFICATION_TONES: Record<
	RecordNotificationKind,
	ReadonlyArray<{ frequency: number; offset: number; duration: number }>
> = {
	record: [{ frequency: 440, offset: 0, duration: 0.16 }],
	'personal-best': [
		{ frequency: 523.25, offset: 0, duration: 0.16 },
		{ frequency: 659.25, offset: 0.12, duration: 0.2 },
	],
	'world-record': [
		{ frequency: 659.25, offset: 0, duration: 0.16 },
		{ frequency: 783.99, offset: 0.11, duration: 0.18 },
		{ frequency: 1046.5, offset: 0.22, duration: 0.28 },
	],
}

export function selectRecordNotificationKind(
	records: ReadonlyArray<Pick<RecordHistoryRow, 'pbOrWr' | 'userId'>>,
	onlyUserId?: number,
): RecordNotificationKind | null {
	const eligible =
		onlyUserId === undefined
			? records
			: records.filter((record) => record.userId === onlyUserId)
	if (eligible.length === 0) return null
	if (eligible.some((record) => record.pbOrWr === 'world-record')) return 'world-record'
	if (eligible.some((record) => record.pbOrWr === 'personal-best')) return 'personal-best'
	return 'record'
}
