export type LevelCompetitivenessRating =
	| 'veryEasy'
	| 'easy'
	| 'casual'
	| 'balanced'
	| 'competitive'
	| 'hard'
	| 'expert'
	| 'intense'

export function getLevelCompetitivenessRating(
	value: number | null | undefined,
): LevelCompetitivenessRating | null {
	if (value == null || !Number.isFinite(value)) return null
	if (value <= 0.5) return 'veryEasy'
	if (value <= 1) return 'easy'
	if (value <= 1.2) return 'casual'
	if (value <= 1.4) return 'balanced'
	if (value <= 1.5) return 'competitive'
	if (value <= 1.65) return 'hard'
	if (value <= 1.75) return 'expert'
	return 'intense'
}
