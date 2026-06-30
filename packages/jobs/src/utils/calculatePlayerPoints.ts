interface PersonalBest {
	idLevel: number
	idRecord: number
	levelPoints: number
	position: bigint
}

export interface PlayerPointContribution {
	idLevel: number
	idRecord: number
	contributionRank: number
	levelPosition: number
	levelPoints: number
	levelDecayedPoints: number
	playerDecayedPoints: number
}

interface CalculatePlayerPointsResult {
	points: number
	totalPoints: number
	contributions: PlayerPointContribution[]
}

const GLOBAL_DECAY_FACTOR = 0.95
const LEVEL_DECAY_FACTOR = 0.985
export const PLAYER_SCORE_PB_LIMIT = 300
export const PLAYER_SCORE_CONTRIBUTION_LIMIT = 200

function calculatePlayerPointsDecayed(points: number, position: number, decayFactor: number) {
	if (position < 1 || !Number.isFinite(points) || points <= 0) {
		return 0
	}

	const decay = decayFactor ** (position - 1)
	return points * decay
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
