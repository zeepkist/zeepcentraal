import type { GhostRecordSource } from './ghost'

export type TrackTournamentType = 0 | 1

export type TournamentStanding = {
	tournamentId: number
	userId: number
	recordId: number
	time: number
	rank: number
	points: number
	steamId: string | null
	steamName: string | null
	setAt: string | null
	ghost: GhostRecordSource | null
	pinned?: boolean
}

export type TournamentLevel = {
	id: number
	xxHash: string
	name: string
	imageUrl: string | null
	authorName: string | null
	authorSteamId: string | null
	points: number | null
}

export type TournamentSummary = {
	id: number
	type: TrackTournamentType
	slug: string
	startAt: string
	endAt: string
	finalizedAt: string | null
	participantCount: number
	level: TournamentLevel
	podium: TournamentStanding[]
}

export type TournamentNavigation = {
	previous: TournamentSummary | null
	current: TournamentSummary | null
	next: TournamentSummary | null
}
