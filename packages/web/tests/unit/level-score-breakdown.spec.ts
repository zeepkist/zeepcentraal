import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const query = readFileSync(
	new URL('../../app/graphql/queries/levelDetail.graphql', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/level/[xxh128].vue', import.meta.url), 'utf8')
const component = readFileSync(
	new URL('../../app/components/level/LevelScoreBreakdown.vue', import.meta.url),
	'utf8',
)
const locale = readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8')

const scoreFields = [
	'sampleSize',
	'leaderboardConfidence',
	'inputSampleSize',
	'inputCoverage',
	'airSampleSize',
	'wheelSampleSize',
	'slipSampleSize',
	'ragdollSampleSize',
	'stateSampleSize',
	'surfaceSampleSize',
	'velocitySampleSize',
	'competitivenessScore',
	'worldRecordDifficultyScore',
	'participationScore',
	'passivePlaySeverity',
	'modifierAfk',
	'passiveRunRatio',
	'passiveTop10Share',
	'bestPassiveRank',
	'bestPassiveGap',
	'driverEngagementScore',
	'worldRecordMargin',
	'top5Spread',
	'top10Spread',
	'top50Spread',
	'wrChallengerCount',
	'worldRecordOptimizationScore',
	'leaderboardAnomalyScore',
	'telemetryAnomalyScore',
	'worldRecordExcluded',
	'pathConsistencyScore',
	'speedConsistencyScore',
	'routeConsistencyScore',
	'surfaceDiversityScore',
	'matureVoteCount',
	'typicalDistance',
	'typicalAverageSpeed',
	'typicalMaxSpeed',
	'typicalAirTimeShare',
	'typicalGroundTimeShare',
	'typicalSlipShare',
	'typicalRagdollShare',
	'typicalAverageAngularVelocity',
	'typicalAverageGforce',
	'medianSteeringShare',
	'q25SteeringShare',
	'lowSteeringRatio',
	'zeroControlRatio',
	'medianBrakeShare',
	'medianArmsUpShare',
	'medianControlTransitionRate',
] as const

describe('level score breakdown', () => {
	it('requests every persisted score and descriptive signal', () => {
		for (const field of scoreFields) expect(query).toMatch(new RegExp(`\\n\\s+${field}\\n`))
		expect(query).toContain('modifierRating')
		expect(query).not.toContain('typicalFourWheelShare')
		expect(query).not.toContain('scoreVersion')
	})

	it('renders through a request-free data-fed component', () => {
		expect(page).toContain('<LevelScoreBreakdown')
		expect(page).toContain(':model="levelData.scoreInsights.value"')
		expect(component).toContain('model: LevelScoreInsights')
		expect(component).not.toMatch(/useQuery|useFetch|\$fetch/)
	})

	it('uses requested missing-value language', () => {
		expect(locale).toContain('"unavailable": "-"')
		expect(locale).toContain('"notAvailable": "N/A"')
		expect(`${component}\n${page}\n${locale}`).not.toContain('Insufficient telemetry')
	})
})
