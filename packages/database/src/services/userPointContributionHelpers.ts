interface UserPointContributionInput {
	contributionRank: number
	idLevel: number
	idRecord: number
	idUser: number
	levelDecayedPoints: number
	levelPoints: number
	levelPosition: number
	playerDecayedPoints: number
}

function normalizedPoints(value: number): number {
	return Math.round(value * 1000)
}

export function sortedUniqueUserIds(idUsers: readonly number[]): number[] {
	return [...new Set(idUsers)].toSorted((left, right) => left - right)
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
