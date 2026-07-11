const DASHBOARD_TIME_ZONE = 'Europe/London'
const DAY_MS = 24 * 60 * 60 * 1000

type DateParts = {
	year: number
	month: number
	day: number
	hour: number
	minute: number
	second: number
}

export type DashboardMetricWindows = {
	daySince: string
	monthSince: string
}

function dateParts(date: Date, timeZone: string): DateParts {
	const values = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(date)
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, Number(part.value)]),
	)

	return {
		year: values.year ?? 0,
		month: values.month ?? 1,
		day: values.day ?? 1,
		hour: values.hour ?? 0,
		minute: values.minute ?? 0,
		second: values.second ?? 0,
	}
}

function timeZoneOffset(date: Date, timeZone: string): number {
	const parts = dateParts(date, timeZone)
	const wallClock = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	)
	return wallClock - Math.floor(date.getTime() / 1000) * 1000
}

function startOfMonthInTimeZone(date: Date, timeZone: string): Date {
	const { year, month } = dateParts(date, timeZone)
	const wallClock = Date.UTC(year, month - 1, 1)
	let candidate = wallClock - timeZoneOffset(new Date(wallClock), timeZone)
	candidate = wallClock - timeZoneOffset(new Date(candidate), timeZone)
	return new Date(candidate)
}

export function getDashboardMetricWindows(now = new Date()): DashboardMetricWindows {
	return {
		daySince: new Date(now.getTime() - DAY_MS).toISOString(),
		monthSince: startOfMonthInTimeZone(now, DASHBOARD_TIME_ZONE).toISOString(),
	}
}
