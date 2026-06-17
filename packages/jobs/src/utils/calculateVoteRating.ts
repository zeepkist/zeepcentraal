const DEFAULT_VOTE_RATING = 0.5;
const Z = 1;
const Z2 = Z * Z;

function wilsonLowerBound(upVotes: number, totalVotes: number): number {
	if (totalVotes === 0) return 0;

	const p = upVotes / totalVotes;
	const denominator = 1 + Z2 / totalVotes;
	const centre = p + Z2 / (2 * totalVotes);
	const margin = Z * Math.sqrt((p * (1 - p) + Z2 / (4 * totalVotes)) / totalVotes);

	return (centre - margin) / denominator;
}

export function calculateVoteRating(votes: number[]): number {
	const totalVotes = votes.length;
	if (totalVotes === 0) return DEFAULT_VOTE_RATING;

	let sum = 0;
	for (let index = 0; index < totalVotes; index++) {
		const vote = votes[index] ?? 0;
		sum += (vote + 2) / 4;
	}

	const average = sum / totalVotes;
	const upvotes = average * totalVotes;
	const lowerBound = wilsonLowerBound(upvotes, totalVotes);

	return Number.isFinite(lowerBound)
		? Number(Math.max(0, Math.min(1, lowerBound)).toFixed(6))
		: DEFAULT_VOTE_RATING;
}
