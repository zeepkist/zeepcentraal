export type TournamentNotificationKind = 'record' | 'third' | 'second' | 'first'

export function selectTournamentNotificationKind(
	ranks: readonly number[],
): TournamentNotificationKind | null {
	if (ranks.length === 0) return null
	if (ranks.includes(1)) return 'first'
	if (ranks.includes(2)) return 'second'
	if (ranks.includes(3)) return 'third'
	return 'record'
}

export const TOURNAMENT_NOTIFICATION_TONES: Record<
	TournamentNotificationKind,
	ReadonlyArray<{ frequency: number; offset: number; duration: number }>
> = {
	record: [{ frequency: 440, offset: 0, duration: 0.15 }],
	third: [
		{ frequency: 392, offset: 0, duration: 0.15 },
		{ frequency: 523.25, offset: 0.12, duration: 0.2 },
	],
	second: [
		{ frequency: 493.88, offset: 0, duration: 0.15 },
		{ frequency: 659.25, offset: 0.11, duration: 0.18 },
		{ frequency: 783.99, offset: 0.22, duration: 0.22 },
	],
	first: [
		{ frequency: 523.25, offset: 0, duration: 0.16 },
		{ frequency: 659.25, offset: 0.1, duration: 0.17 },
		{ frequency: 783.99, offset: 0.2, duration: 0.2 },
		{ frequency: 1046.5, offset: 0.31, duration: 0.3 },
	],
}
