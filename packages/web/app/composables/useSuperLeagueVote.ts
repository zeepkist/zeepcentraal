export type SuperLeagueVoteCandidate = {
	levelId: number
	workshopId: number
	xxHash: string
	adventure: boolean
	dateCreated: string
	name: string | null
	imageUrl: string | null
	authorName: string | null
	points: number | null
	rating: number | null
	recordCount: number
	personalBestCount: number
	voteCount: number
	selfAuthored: boolean
}

export type SuperLeagueVoteSnapshot = {
	roundId: number
	contestId: number | null
	submissionStart: string | null
	submissionEnd: string | null
	zslVoteEnd: string | null
	cosmeticVoteEnd: string | null
	submissionsOpen: boolean
	votingPending: boolean
	openTypes: number[]
	candidates: SuperLeagueVoteCandidate[]
	votes: number[][]
}

export function useSuperLeagueVote(roundId: MaybeRef<number | undefined> = undefined) {
	const read = useSuperLeagueRead<SuperLeagueVoteSnapshot | null>('vote', roundId)
	return {
		snapshot: read.data,
		pending: read.pending,
		resolved: read.resolved,
		error: read.error,
		refresh: read.refresh,
		initial: read.initial,
	}
}
