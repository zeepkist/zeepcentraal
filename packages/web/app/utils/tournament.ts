import type { Zc_TrackTournamentFeatureFragment } from '~/graphql/generated/graphql'
import type { TournamentFeature, TrackTournamentType } from '~/types/tournament'
import { getLevelDisplayName } from './levelDisplay'

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

export function isTrackTournamentActive(
	tournament: Pick<TournamentFeature, 'endAt' | 'finalizedAt' | 'startAt'>,
	now: Date = new Date(),
): boolean {
	const current = now.getTime()
	const start = Date.parse(tournament.startAt)
	const end = Date.parse(tournament.endAt)
	return (
		tournament.finalizedAt === null &&
		Number.isFinite(start) &&
		Number.isFinite(end) &&
		start <= current &&
		current < end
	)
}

export function shouldShowTournamentHowTo(
	active: boolean,
	authenticated: boolean,
	hasViewerTime: boolean,
): boolean {
	return active && (!authenticated || !hasViewerTime)
}

export function mapTournamentFeature(
	node: Zc_TrackTournamentFeatureFragment | null | undefined,
): TournamentFeature | null {
	const level = node?.level
	if (!node || !level) return null
	const item = level.levelItems.nodes[0]
	return {
		id: node.id,
		type: node.type as TrackTournamentType,
		slug: node.slug,
		startAt: String(node.startAt),
		endAt: String(node.endAt),
		finalizedAt: node.finalizedAt == null ? null : String(node.finalizedAt),
		participantCount: node.trackTournamentResults.totalCount,
		level: {
			id: level.id,
			xxHash: level.xxHash,
			name: getLevelDisplayName(item?.name, level.xxHash),
			imageUrl: item?.imageUrl ?? null,
			authorName: item?.author?.steamName ?? null,
			authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
			points: null,
		},
	}
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
