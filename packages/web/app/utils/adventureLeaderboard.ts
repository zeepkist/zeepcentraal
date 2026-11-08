import type { Zc_AdventureStandingFragment } from '@zeepkist/graphql/generated'

export type AdventureStanding = Zc_AdventureStandingFragment & { pinned?: boolean }

export function pinAdventureViewer(
	entries: Zc_AdventureStandingFragment[],
	viewer?: Zc_AdventureStandingFragment | null,
): AdventureStanding[] {
	return viewer && !entries.some((entry) => entry.userId === viewer.userId)
		? [...entries, { ...viewer, pinned: true }]
		: entries
}

export function adventureRecordMilliseconds(seconds: number): number {
	// Restore PostgreSQL real precision before applying the leaderboard's rounding.
	return Math.floor(Math.fround(seconds) * 1000 + 0.5)
}

export function formatAdventureDelta(milliseconds: number): string {
	return `${milliseconds > 0 ? '+' : milliseconds < 0 ? '−' : ''}${formatAdventureTime(Math.abs(milliseconds))}`
}

export function formatAdventureTime(milliseconds: unknown): string {
	const value = Math.max(0, Number(milliseconds ?? 0))
	const hours = Math.floor(value / 3_600_000)
	const minutes = Math.floor(value / 60_000) % 60
	const seconds = Math.floor(value / 1000) % 60
	const fraction = String(value % 1000).padStart(3, '0')
	const body = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${fraction}`
	return hours ? `${hours}:${body}` : body
}
