import { describe, expect, it } from 'vitest'
import {
	type LevelScoreInsightsSource,
	mapLevelScoreInsights,
} from '../../app/utils/levelScoreInsights'

const source = {
	points: 8_000,
	rating: 1.2,
	modifierLength: 0.91,
	modifierEvidence: 0.82,
	modifierQuality: 0.73,
	modifierRating: 1.04,
	complexityConfidence: 0.52,
	complexityScore: 0.63,
	fieldStrength: 0.74,
	qualityScore: 0.68,
	skillAlignment: 0.77,
	skillConfidence: 0.66,
	skillSampleSize: 42,
	skillScore: 0.71,
	skillSeparation: 0.08,
} satisfies LevelScoreInsightsSource

describe('level score insights', () => {
	it('maps GraphQL modifier names to reactor factor names', () => {
		expect(mapLevelScoreInsights(source)).toEqual({
			complexityConfidence: 0.52,
			complexityScore: 0.63,
			evidenceModifier: 0.82,
			fieldStrength: 0.74,
			lengthModifier: 0.91,
			qualityModifier: 0.73,
			qualityScore: 0.68,
			skillAlignment: 0.77,
			skillConfidence: 0.66,
			skillSampleSize: 42,
			skillScore: 0.71,
			skillSeparation: 0.08,
			voteAdjustment: 1.04,
		})
	})

	it('keeps unavailable values undefined when no level-points row exists', () => {
		expect(mapLevelScoreInsights(undefined)).toEqual({
			complexityConfidence: undefined,
			complexityScore: undefined,
			evidenceModifier: undefined,
			fieldStrength: undefined,
			lengthModifier: undefined,
			qualityModifier: undefined,
			qualityScore: undefined,
			skillAlignment: undefined,
			skillConfidence: undefined,
			skillSampleSize: undefined,
			skillScore: undefined,
			skillSeparation: undefined,
			voteAdjustment: undefined,
		})
	})
})
