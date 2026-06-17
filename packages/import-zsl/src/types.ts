interface EventMetadata {
	name: string;
	workshopId: string;
}

export interface SeasonMetadata {
	events: Record<string, EventMetadata>;
	points: number[];
	finishPoints: number;
	bestOf?: number;
}

type SeasonId = string;

export type SuperLeagueMetadata = Array<[SeasonId, SeasonMetadata]>;

interface TournamentUser {
	username: string;
	totalPoints: number;
	pointsPerRound: number[];
	steamId: string;
}

interface TournamentStanding {
	steamId: string;
	time: number;
	points: number;
	username: string;
}

interface TournamentLevel {
	level: string;
	standings: TournamentStanding[];
}

export interface TournamentEvent {
	users: TournamentUser[];
	levels: TournamentLevel[];
}

export interface SeasonStanding {
	username: string;
	team: string;
	totalPoints: number;
	pointsPerRound: number[];
	steamId: string;
}
