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
	'modifierLength',
	'modifierCompetitiveness',
	'modifierEvidence',
	'modifierQuality',
	'modifierRating',
	'competitiveMerit',
	'complexityConfidence',
	'complexityScore',
	'fieldStrength',
	'qualityScore',
	'skillAlignment',
	'skillConfidence',
	'skillSampleSize',
	'skillScore',
	'skillSeparation',
	'worldRecordExcluded',
] as const

describe('level score breakdown', () => {
	it('requests exact retained score and selectivity signals', () => {
		for (const field of scoreFields) expect(query).toMatch(new RegExp(`\\n\\s+${field}\\n`))
		for (const field of [
			'modifierPopularity',
			'sampleSize',
			'passivePlaySeverity',
			'scoreVersion',
		]) {
			expect(query).not.toContain(field)
		}
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
