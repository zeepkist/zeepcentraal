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

export type LevelPointContribution = Omit<
	PlayerPointContribution,
	'contributionRank' | 'playerDecayedPoints'
>

export interface CalculatePlayerPointsResult {
	contributions: PlayerPointContribution[]
	points: number
	totalPoints: number
}

export const GLOBAL_DECAY_FACTOR = 0.95
export const LEVEL_DECAY_FACTOR = 0.985
// PostgreSQL real uses IEEE-754 binary32; smaller positive values cannot be persisted safely.
export const MIN_PERSISTED_DECAYED_POINTS = 2 ** -149

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

export function calculatePlayerPointsDecayed(
	points: number,
	position: number,
	decayFactor: number,
) {
	if (!Number.isFinite(points) || points <= 0) {
		return 0
	}

	const decayedPoints = points * calculateDecayMultiplier(position, decayFactor)
	return decayedPoints < MIN_PERSISTED_DECAYED_POINTS ? 0 : decayedPoints
}

export function calculatePlayerPointsFromContributions(
	contributions: LevelPointContribution[],
): CalculatePlayerPointsResult {
	const totals = {
		points: 0,
		totalPoints: 0,
	}

	const rankedContributions = contributions
		.filter(
			(contribution) =>
				contribution.levelPosition >= 1 &&
				Number.isFinite(contribution.levelPosition) &&
				contribution.levelPoints > 0 &&
				Number.isFinite(contribution.levelDecayedPoints),
		)
		.sort(
			(a, b) =>
				b.levelDecayedPoints - a.levelDecayedPoints ||
				a.idLevel - b.idLevel ||
				a.idRecord - b.idRecord,
		)
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
		contributions: rankedContributions,
	}
}

export const calculatePlayerPoints = (personalBests: PersonalBest[]): CalculatePlayerPointsResult =>
	calculatePlayerPointsFromContributions(
		personalBests.flatMap(({ idLevel, idRecord, levelPoints, position }) => {
			const levelPosition = Number(position)
			if (!Number.isFinite(levelPosition) || levelPosition < 1 || levelPoints <= 0) {
				return []
			}

			return [
				{
					idLevel,
					idRecord,
					levelPosition,
					levelPoints,
					levelDecayedPoints: calculatePlayerPointsDecayed(
						levelPoints,
						levelPosition,
						LEVEL_DECAY_FACTOR,
					),
				},
			]
		}),
	)
