export interface AdminRecord {
	id: number
	name: string
	version: string
}

export interface Points extends AdminRecord {
	bestOf: number
	minimumPoints: number
	points: number[]
}

export interface Season extends AdminRecord {
	endDate: string
	pointsStructureId: number
	startDate: string
}

export interface Round extends AdminRecord {
	cosmeticVoteEnd: string | null
	event2Date: string | null
	eventDate: string
	number: number
	seasonId: number
	steamAnnouncementId: string | null
	submissionEnd: string | null
	submissionStart: string | null
	workshopId: string
	zslVoteEnd: string | null
}

export interface ZslDashboard {
	points: Points[]
	rounds: Round[]
	seasons: Season[]
}

export function londonTimestamp(value?: string | null) {
	if (!value) return ''
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/London',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
		timeZoneName: 'longOffset',
	}).formatToParts(new Date(value))
	const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
	const offset = fields.timeZoneName?.replace('GMT', '') || '+00:00'
	return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}${offset}`
}

export function zslError(error: unknown) {
	const payload = error as {
		data?: { data?: { detail?: string }; detail?: string }
		message?: string
	}
	return payload.data?.data?.detail ?? payload.data?.detail ?? payload.message ?? 'Request failed'
}
