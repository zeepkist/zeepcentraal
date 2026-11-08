import type { Zc_TrackTournamentOverallStandingFragment } from '@zeepkist/graphql/generated'

export type TournamentOverallStanding = Zc_TrackTournamentOverallStandingFragment & {
	pinned?: boolean
}

export function pinOverallViewer(
	rows: Zc_TrackTournamentOverallStandingFragment[],
	viewer?: Zc_TrackTournamentOverallStandingFragment | null,
): TournamentOverallStanding[] {
	return viewer && !rows.some((row) => row.userId === viewer.userId)
		? [...rows, { ...viewer, pinned: true }]
		: rows
}
