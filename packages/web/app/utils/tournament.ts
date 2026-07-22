import type { TrackTournamentType } from '~/types/tournament'

const ROTATION_PENDING_GRACE_MS = 5 * 60_000

export function nextTournamentBoundary(type: TrackTournamentType, at: Date): Date {
	if (type === 0) {
		const next = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 6))
		if (
			at.getUTCDay() === 1 &&
			at.getTime() >= next.getTime() &&
			at.getTime() < next.getTime() + ROTATION_PENDING_GRACE_MS
		) {
			return next
		}
		const daysUntilMonday = (8 - next.getUTCDay()) % 7 || 7
		next.setUTCDate(next.getUTCDate() + daysUntilMonday)
		if (at.getUTCDay() === 1 && at.getUTCHours() < 6) next.setUTCDate(next.getUTCDate() - 7)
		return next
	}
	const next = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 6))
	if (
		at.getUTCDate() === 1 &&
		at.getTime() >= next.getTime() &&
		at.getTime() < next.getTime() + ROTATION_PENDING_GRACE_MS
	) {
		return next
	}
	if (next.getTime() <= at.getTime()) next.setUTCMonth(next.getUTCMonth() + 1)
	return next
}

export function tournamentPath(type: TrackTournamentType, slug?: string): string {
	const root = type === 0 ? '/totw' : '/totm'
	return slug ? `${root}/${slug}` : root
}

export function formatTournamentPeriod(
	type: TrackTournamentType,
	slug: string,
	locale: string,
	formatWeekly: (period: { year: number; week: number }) => string,
): string {
	if (type === 0) {
		const match = /^(\d{4})-w(\d{2})$/.exec(slug)
		if (!match) return slug
		const year = Number(match[1])
		const week = Number(match[2])
		return week >= 1 && week <= 53 ? formatWeekly({ year, week }) : slug
	}

	const match = /^(\d{4})-(\d{2})$/.exec(slug)
	if (!match) return slug
	const year = Number(match[1])
	const month = Number(match[2])
	if (month < 1 || month > 12) return slug
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function formatTournamentTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

export function formatTournamentDelta(time: number, fastestTime: number): string | null {
	const delta = Math.max(0, time - fastestTime)
	if (delta < 0.0005) return null
	return delta < 60 ? `+${delta.toFixed(3)}` : `+${formatTournamentTime(delta)}`
}
