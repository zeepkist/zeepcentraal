import { startOfMonthInTimeZone } from './timeWindows'

const DASHBOARD_TIME_ZONE = 'Europe/London'
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const ROLLING_MONTH_MS = 30 * DAY_MS

export type DashboardMetricWindows = {
	daySince: string
	monthSince: string
}

export type DashboardLevelWindows = {
	weekSince: string
	rollingMonthSince: string
}

export function getDashboardMetricWindows(now = new Date()): DashboardMetricWindows {
	return {
		daySince: new Date(now.getTime() - DAY_MS).toISOString(),
		monthSince: startOfMonthInTimeZone(now, DASHBOARD_TIME_ZONE).toISOString(),
	}
}

export function getDashboardLevelWindows(now = new Date()): DashboardLevelWindows {
	return {
		weekSince: new Date(now.getTime() - WEEK_MS).toISOString(),
		rollingMonthSince: new Date(now.getTime() - ROLLING_MONTH_MS).toISOString(),
	}
}

export function formatDashboardMonth(monthSince: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		timeZone: DASHBOARD_TIME_ZONE,
	}).format(new Date(monthSince))
}
