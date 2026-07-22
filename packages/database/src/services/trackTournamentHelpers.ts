export const TRACK_TOURNAMENT_TYPE = {
	weekly: 0,
	monthly: 1,
} as const

export type TrackTournamentType = (typeof TRACK_TOURNAMENT_TYPE)[keyof typeof TRACK_TOURNAMENT_TYPE]

export function isTrackTournamentType(value: number): value is TrackTournamentType {
	return value === TRACK_TOURNAMENT_TYPE.weekly || value === TRACK_TOURNAMENT_TYPE.monthly
}

export function calculateTrackTournamentPoints(rank: number): number {
	if (!Number.isInteger(rank) || rank < 1) return 2
	const raw = 1000 * 0.96 ** (rank - 1)
	return Math.max(2, Math.ceil(raw / 2) * 2)
}

function isoWeek(date: Date): { week: number; year: number } {
	const thursday = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	)
	const day = thursday.getUTCDay() || 7
	thursday.setUTCDate(thursday.getUTCDate() + 4 - day)
	const year = thursday.getUTCFullYear()
	const yearStart = new Date(Date.UTC(year, 0, 1))
	const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
	return { week, year }
}

export function getTrackTournamentPeriod(type: TrackTournamentType, at: Date) {
	if (type === TRACK_TOURNAMENT_TYPE.weekly) {
		const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 6))
		const daysSinceMonday = (start.getUTCDay() + 6) % 7
		start.setUTCDate(start.getUTCDate() - daysSinceMonday)
		if (at.getTime() < start.getTime()) start.setUTCDate(start.getUTCDate() - 7)
		const end = new Date(start)
		end.setUTCDate(end.getUTCDate() + 7)
		const { week, year } = isoWeek(start)
		return {
			start,
			end,
			slug: `${year}-w${String(week).padStart(2, '0')}`,
		}
	}

	const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 6))
	if (at.getTime() < start.getTime()) start.setUTCMonth(start.getUTCMonth() - 1)
	const end = new Date(start)
	end.setUTCMonth(end.getUTCMonth() + 1)
	return {
		start,
		end,
		slug: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
	}
}

export function isTrackTournamentBoundary(type: TrackTournamentType, at: Date): boolean {
	if (at.getUTCHours() !== 6) return false
	return type === TRACK_TOURNAMENT_TYPE.weekly ? at.getUTCDay() === 1 : at.getUTCDate() === 1
}
