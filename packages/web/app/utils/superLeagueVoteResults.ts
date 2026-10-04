import type { SuperLeagueVoteSnapshot } from '~/composables/useSuperLeagueVote'

export type VoteResultLevel = {
	levelId: number
	xxHash: string
	name: string | null
	imageUrl: string | null
	votes: number
}

export type VoteResultCategory = {
	voteType: number
	deadline: string | null
	state: 'pending' | 'published' | 'unavailable'
	totalVotes: number | null
	levels: VoteResultLevel[]
}

export type VoteResultsSnapshot = {
	roundId: number
	categories: VoteResultCategory[]
}

export function voteResultMarkers(
	roundId: number | undefined,
	snapshot: SuperLeagueVoteSnapshot | null,
) {
	if (!roundId || snapshot?.roundId !== roundId) {
		return {
			voted: [new Set<number>(), new Set<number>(), new Set<number>()],
			own: new Set<number>(),
		}
	}
	return {
		voted: snapshot.votes.map((votes) => new Set(votes)),
		own: new Set(
			snapshot.candidates
				.filter((candidate) => candidate.selfAuthored)
				.map((candidate) => candidate.levelId),
		),
	}
}

export function voteResultChartData(levels: VoteResultLevel[], voted: Set<number>) {
	return levels.map((level) => ({
		levelId: level.levelId,
		name: level.name ?? level.xxHash,
		votes: voted.has(level.levelId) ? 0 : level.votes,
		votedVotes: voted.has(level.levelId) ? level.votes : 0,
		totalVotes: level.votes,
	}))
}

export function nextContestDeadline(
	deadlines: readonly (string | null | undefined)[],
	now: number,
) {
	const future = deadlines
		.map((deadline) => (deadline ? Date.parse(deadline) : Number.NaN))
		.filter((deadline) => Number.isFinite(deadline) && deadline > now)
	return future.length ? Math.min(2_147_483_647, Math.min(...future) - now + 1_000) : null
}
