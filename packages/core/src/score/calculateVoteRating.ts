export const DEFAULT_VOTE_RATING = 0.5
export const NEGATIVE_VOTE_WEIGHT = 0.75
export const VOTE_RATING_MATURITY_MS = 7 * 24 * 60 * 60 * 1_000
const Z = 1
const Z2 = Z * Z

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

function wilsonLowerBound(upVotes: number, totalVotes: number): number {
	if (totalVotes === 0) return 0

	const p = upVotes / totalVotes
	const denominator = 1 + Z2 / totalVotes
	const centre = p + Z2 / (2 * totalVotes)
	const margin = Z * Math.sqrt((p * (1 - p) + Z2 / (4 * totalVotes)) / totalVotes)

	return (centre - margin) / denominator
}

export function calculateVoteRating(votes: number[]): number {
	const totalVotes = votes.length
	if (totalVotes === 0) return DEFAULT_VOTE_RATING

	let sum = 0
	for (let index = 0; index < totalVotes; index++) {
		const vote = votes[index] ?? 0
		sum += calculateVoteScore(vote)
	}

	const average = sum / totalVotes
	const upvotes = average * totalVotes
	const lowerBound = wilsonLowerBound(upvotes, totalVotes)

	return Number.isFinite(lowerBound)
		? Number(Math.max(0, Math.min(1, lowerBound)).toFixed(6))
		: DEFAULT_VOTE_RATING
}
