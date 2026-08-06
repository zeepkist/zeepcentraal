export function dateRange(
	range: string,
	customFrom: string | null,
	customTo: string | null,
	now: Date,
): { from: string; label: string; to: string } {
	const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const nextDay = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)
	const weekStart = new Date(startToday)
	weekStart.setDate(startToday.getDate() - ((startToday.getDay() + 6) % 7))
	const year = now.getFullYear()
	const month = now.getMonth()
	let from: Date
	let to: Date
	switch (range) {
		case 'today':
			from = startToday
			to = nextDay(startToday, 1)
			break
		case 'yesterday':
			from = nextDay(startToday, -1)
			to = startToday
			break
		case 'this-week':
			from = weekStart
			to = nextDay(now, 1)
			break
		case 'last-week':
			from = nextDay(weekStart, -7)
			to = weekStart
			break
		case 'this-month':
			from = new Date(year, month, 1)
			to = nextDay(now, 1)
			break
		case 'last-month':
			from = new Date(year, month - 1, 1)
			to = new Date(year, month, 1)
			break
		case 'this-year':
			from = new Date(year, 0, 1)
			to = nextDay(now, 1)
			break
		case 'last-year':
			from = new Date(year - 1, 0, 1)
			to = new Date(year, 0, 1)
			break
		case 'all-time':
			from = new Date('2000-01-01T00:00:00.000Z')
			to = nextDay(now, 1)
			break
		case 'custom': {
			if (!customFrom || !customTo) throw new Error('Custom range needs `from` and `to`.')
			from = new Date(`${customFrom}T00:00:00.000Z`)
			to = nextDay(new Date(`${customTo}T00:00:00.000Z`), 1)
			if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
				throw new Error('Custom date range is invalid.')
			}
			break
		}
		default:
			throw new Error('Unknown date range.')
	}
	return { from: from.toISOString(), to: to.toISOString(), label: range.replaceAll('-', ' ') }
}
