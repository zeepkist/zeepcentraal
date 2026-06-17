interface PersonalBest {
	idLevel: number
	levelPoints: number
	position: bigint
}

interface CalculatePlayerPointsResult {
	points: number
	totalPoints: number
}

const GLOBAL_DECAY_FACTOR = 0.95
const LEVEL_DECAY_FACTOR = 0.985

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
	const pointsList: number[] = []
	const totals = {
		points: 0,
		totalPoints: 0,
	}

	for (const { levelPoints, position } of personalBests) {
		const index = Number(position)
		if (!Number.isFinite(index) || index < 1 || levelPoints === 0) {
			continue
		}

		pointsList.push(calculatePlayerPointsDecayed(levelPoints, index, LEVEL_DECAY_FACTOR))
	}

	for (const [index, points] of pointsList.sort((a, b) => b - a).entries()) {
		totals.points += calculatePlayerPointsDecayed(points, index + 1, GLOBAL_DECAY_FACTOR)
		totals.totalPoints += points
	}

	return {
		points: Math.round(totals.points),
		totalPoints: Math.round(totals.totalPoints),
	}
}
