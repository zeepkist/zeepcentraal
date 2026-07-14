import { startOfDayInTimeZone, startOfMonthInTimeZone, startOfYearInTimeZone } from './timeWindows'

export const USER_TELEMETRY_TIME_ZONE = 'Europe/London'

export type UserTelemetryPeriod = 'all-time' | 'today' | 'month' | 'year'

export function getUserTelemetryWindows(now = new Date()) {
	return {
		now: now.toISOString(),
		daySince: startOfDayInTimeZone(now, USER_TELEMETRY_TIME_ZONE).toISOString(),
		monthSince: startOfMonthInTimeZone(now, USER_TELEMETRY_TIME_ZONE).toISOString(),
		yearSince: startOfYearInTimeZone(now, USER_TELEMETRY_TIME_ZONE).toISOString(),
	}
}
