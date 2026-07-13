export type LevelCompetitivenessRating =
	| 'veryEasy'
	| 'easy'
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
	if (value <= 0.75) return 'easy'
	if (value <= 1) return 'balanced'
	if (value <= 1.2) return 'competitive'
	if (value <= 1.45) return 'hard'
	if (value <= 1.75) return 'expert'
	return 'intense'
}
