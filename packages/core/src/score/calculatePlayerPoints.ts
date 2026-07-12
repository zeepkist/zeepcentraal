export interface PersonalBest {
	idLevel: number
	idRecord: number
	levelPoints: number
	position: bigint
}

export interface PlayerPointContribution {
	contributionRank: number
	idLevel: number
	idRecord: number
	levelDecayedPoints: number
	levelPoints: number
	levelPosition: number
	playerDecayedPoints: number
}

export interface CalculatePlayerPointsResult {
	contributions: PlayerPointContribution[]
	points: number
	totalPoints: number
}

export const GLOBAL_DECAY_FACTOR = 0.95
export const LEVEL_DECAY_FACTOR = 0.985
export const PLAYER_SCORE_PB_LIMIT = 300
export const PLAYER_SCORE_CONTRIBUTION_LIMIT = 200

export function calculateDecayMultiplier(position: number, decayFactor: number) {
	if (
		position < 1 ||
		!Number.isFinite(position) ||
		!Number.isFinite(decayFactor) ||
		decayFactor <= 0
	) {
		return 0
	}

	return decayFactor ** (position - 1)
}

function calculatePlayerPointsDecayed(points: number, position: number, decayFactor: number) {
	if (!Number.isFinite(points) || points <= 0) {
		return 0
	}

	return points * calculateDecayMultiplier(position, decayFactor)
}

export const calculatePlayerPoints = (
	personalBests: PersonalBest[],
): CalculatePlayerPointsResult => {
	const contributions: PlayerPointContribution[] = []
	const totals = {
		points: 0,
		totalPoints: 0,
	}

	for (const { idLevel, idRecord, levelPoints, position } of personalBests) {
		const index = Number(position)
		if (!Number.isFinite(index) || index < 1 || levelPoints === 0) {
			continue
		}

		contributions.push({
			idLevel,
			idRecord,
			contributionRank: 0,
			levelPosition: index,
			levelPoints,
			levelDecayedPoints: calculatePlayerPointsDecayed(
				levelPoints,
				index,
				LEVEL_DECAY_FACTOR,
			),
			playerDecayedPoints: 0,
		})
	}

	const rankedContributions = contributions
		.sort(
			(a, b) =>
				b.levelDecayedPoints - a.levelDecayedPoints ||
				a.idLevel - b.idLevel ||
				a.idRecord - b.idRecord,
		)
		.slice(0, PLAYER_SCORE_PB_LIMIT)
		.map((contribution, index) => {
			const contributionRank = index + 1
			return {
				...contribution,
				contributionRank,
				playerDecayedPoints: calculatePlayerPointsDecayed(
					contribution.levelDecayedPoints,
					contributionRank,
					GLOBAL_DECAY_FACTOR,
				),
			}
		})

	for (const contribution of rankedContributions) {
		totals.points += contribution.playerDecayedPoints
		totals.totalPoints += contribution.levelDecayedPoints
	}

	return {
		points: Math.round(totals.points),
		totalPoints: Math.round(totals.totalPoints),
		contributions: rankedContributions.slice(0, PLAYER_SCORE_CONTRIBUTION_LIMIT),
	}
}
