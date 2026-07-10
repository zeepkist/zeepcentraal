interface UserPointContributionInput {
	idUser: number
	idLevel: number
	idRecord: number
	contributionRank: number
	levelPosition: number
	levelPoints: number
	levelDecayedPoints: number
	playerDecayedPoints: number
}

function normalizedPoints(value: number): number {
	return Math.round(value * 1000)
}

export function userPointContributionFingerprint(
	contributions: Omit<UserPointContributionInput, 'idUser'>[],
): string {
	return contributions
		.map((contribution) =>
			[
				contribution.idLevel,
				contribution.idRecord,
				contribution.contributionRank,
				contribution.levelPosition,
				contribution.levelPoints,
				normalizedPoints(contribution.levelDecayedPoints),
				normalizedPoints(contribution.playerDecayedPoints),
			].join(':'),
		)
		.join('|')
}
