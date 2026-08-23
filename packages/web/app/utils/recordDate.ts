const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

export const RECENT_RECORD_AGE_MS = 30 * MINUTE_MS
export const OLD_RECORD_AGE_MS = 365 * DAY_MS

export function getRecordDatePrimaryPercentage(datetime: string | number | Date, now = Date.now()) {
	const timestamp = datetime instanceof Date ? datetime.getTime() : new Date(datetime).getTime()
	if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return 0

	const age = now - timestamp
	if (age <= RECENT_RECORD_AGE_MS) return 100
	if (age >= OLD_RECORD_AGE_MS) return 0

	return Math.round(
		((OLD_RECORD_AGE_MS - age) / (OLD_RECORD_AGE_MS - RECENT_RECORD_AGE_MS)) * 100,
	)
}
