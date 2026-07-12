interface EventMetadata {
	name: string
	workshopId: string
}

export interface SeasonMetadata {
	bestOf?: number
	events: Record<string, EventMetadata>
	finishPoints: number
	points: number[]
}

type SeasonId = string

export type SuperLeagueMetadata = Array<[SeasonId, SeasonMetadata]>

interface TournamentUser {
	pointsPerRound: number[]
	steamId: string
	totalPoints: number
	username: string
}

interface TournamentStanding {
	points: number
	steamId: string
	time: number
	username: string
}

interface TournamentLevel {
	level: string
	standings: TournamentStanding[]
}

export interface TournamentEvent {
	levels: TournamentLevel[]
	users: TournamentUser[]
}

export interface SeasonStanding {
	pointsPerRound: number[]
	steamId: string
	team: string
	totalPoints: number
	username: string
}
