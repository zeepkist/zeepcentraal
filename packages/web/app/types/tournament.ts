import type { GhostRecordSource } from './ghost'

export type TrackTournamentType = 0 | 1

export type UserTrackTournamentResult = {
	id: number
	type: TrackTournamentType
	slug: string
	startAt: string
	endAt: string
	finalizedAt: string | null
	levelName: string | null
	imageUrl: string | null
	authorName: string | null
	rank: number
	points: number
	time: number
}

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

export type TournamentFeature = Omit<TournamentSummary, 'podium'>

export type TournamentNavigation = {
	previous: TournamentSummary | null
	current: TournamentSummary | null
	next: TournamentSummary | null
}
