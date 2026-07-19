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
	if (value <= 0.9) return 'veryEasy'
	if (value <= 1.3) return 'easy'
	if (value <= 1.6) return 'casual'
	if (value <= 1.65) return 'balanced'
	if (value <= 1.7) return 'competitive'
	if (value <= 1.8) return 'hard'
	if (value <= 1.9) return 'expert'
	return 'intense'
}
