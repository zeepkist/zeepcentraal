import type { Zc_LevelDetailQuery } from '@zeepkist/graphql/generated'
import type { LevelScoreInsights } from '~/types/app'

export type LevelScoreInsightsSource = NonNullable<
	NonNullable<Zc_LevelDetailQuery['levelByXxHash']>['levelPoints']
>

export function mapLevelScoreInsights(
	points: LevelScoreInsightsSource | null | undefined,
): LevelScoreInsights {
	return {
		complexityConfidence: points?.complexityConfidence,
		complexityScore: points?.complexityScore,
		evidenceModifier: points?.modifierEvidence,
		fieldStrength: points?.fieldStrength,
		lengthModifier: points?.modifierLength,
		qualityModifier: points?.modifierQuality,
		qualityScore: points?.qualityScore,
		skillAlignment: points?.skillAlignment,
		skillConfidence: points?.skillConfidence,
		skillSampleSize: points?.skillSampleSize,
		skillScore: points?.skillScore,
		skillSeparation: points?.skillSeparation,
		voteAdjustment: points?.modifierRating,
	}
}
