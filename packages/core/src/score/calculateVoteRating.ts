export const DEFAULT_VOTE_RATING = 0.5
export const NEGATIVE_VOTE_WEIGHT = 0.5
export const VOTE_RATING_MATURITY_MS = 7 * 24 * 60 * 60 * 1_000
const MINIMUM_VOTE_COUNT = 5

export function calculateVoteScore(vote: number): number {
	if (!Number.isFinite(vote)) {
		return DEFAULT_VOTE_RATING
	}

	const clampedVote = Math.max(-2, Math.min(2, vote))
	const weightedVote = clampedVote < 0 ? clampedVote * NEGATIVE_VOTE_WEIGHT : clampedVote
	return (weightedVote + 2) / 4
}

export function getVoteRatingMaturityCutoff(now = Date.now()): string {
	return new Date(now - VOTE_RATING_MATURITY_MS).toISOString()
}

export function calculateVoteRating(votes: number[]): number {
	const totalVotes = votes.length
	if (totalVotes < MINIMUM_VOTE_COUNT) return DEFAULT_VOTE_RATING

	let sum = 0
	for (let index = 0; index < totalVotes; index++) {
		const vote = votes[index] ?? 0
		sum += calculateVoteScore(vote)
	}

	const average = sum / totalVotes

	return Number.isFinite(average)
		? Number(Math.max(0, Math.min(1, average)).toFixed(6))
		: DEFAULT_VOTE_RATING
}
